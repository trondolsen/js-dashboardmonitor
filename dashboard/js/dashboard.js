/***
 * Dashboard for ActiveExperts
 * 
 * Version: 0.8
 *
 * Copyright (c) 2017-2018 Trond Olsen
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
  */

((browser,ElementSeq) => {

  const settings = {
    title: 'Applications',
    searchFilter: '',
    ignoreFolderName: '\\_',
    clearConsoleInMinutes: 30,
    layout: {
      textColumnWidth: { name: 18, host: 18, detail: 18 },
    },
    datasource: {
      updateInMinutes: 1,
      insyncInMinutes: 5,
      requestInit: {cache:'no-cache', credentials: 'same-origin'},
      sources: [
        {name: 'ExampleData', checks: {url: 'ExampleChecks.xml'}, availability: {url: 'ExampleAvailabilty.xml'}}
      ]
    }
  };
  const data = { folders: {}, checks: [] };

  (() => {
    // Handle grid layout resizing
    dom(browser)
      .event('resize', () => {
        layoutGrid(query('#checks'), query('.card'));
        query('.navbar').prop('scrollHeight', (value) => dom(browser.document.body).attr('padding-top', () => value + "px"));
      })

    dom(browser.document)
      .event('DOMContentLoaded', () => {
        layoutGrid(query('#checks'), query('.card'));
        query('.navbar').prop('scrollHeight', (value) => dom(browser.document.body).attr('padding-top', () => value + "px"));
      })

    // Set title
    query('.navbar .topbar .text').text(settings.title);

    // Handle search text
    query('.navbar .searchbar .form-control')
      .event('keyup', (event) => {
        browser.scrollTop = 0;
        settings.searchFilter = event.target.value.toLowerCase();
        filterChecks();
      })
      .event('keypress', (event) => {
        if (event.keyCode == 13) {
          event.preventDefault();
        }
      });

    // Show datasources
    for (const source of settings.datasource.sources) {
      query('#datasources')
        .append(span({props: {id: 'ds-' + source.name}, attrs: ['datasource']})
          .append(span({props: {textContent: ''}, attrs: ['icon','mx-1']}))
          .append(span({props: {textContent: source.name, title: `${source.name}\nChecks URL: ${source.checks.url}\nAvailability URL: ${source.availability.url}`}, attrs: ['text','datasource-tooltip']}))
      );
    }

    // Repeated fetching of datasources
    browser.console.info(`Dashboard started. Fetching datasource(s) at ${settings.datasource.updateInMinutes} minute interval.`);
    const fetchSources = () => {
      Promise.all(
        settings.datasource.sources.map(async (source) => {
          try {
            const checksData = fetchText(source.name, source.checks.url, settings.datasource.requestInit);
            const availabilityData = fetchText(source.name, source.availability.url, settings.datasource.requestInit);
            readChecks(parseXml(await checksData), source);
            showChecks();
            layoutGrid(query('#checks'), query('.card'));
            filterChecks();
            readAvailability(parseXml(await availabilityData), source);
            showAvailability(source);
          }
          catch (reason) {
            showAlert({id: `alert-source-${source.name}`, text: reason.message });
          }
        })
      );
    }
    browser.setInterval(fetchSources, settings.datasource.updateInMinutes * 60 * 1000);
    fetchSources();

    // Clear console at regular intervals
    browser.setInterval(() => { browser.console.clear(); }, settings.clearConsoleInMinutes * 60 * 1000);
  })();

  function filterChecks() {
    if (settings.searchFilter.length > 0 ) {
      // Apply search filter on folders
      for (const folder of Object.values(data.folders)) {
        const html = query('#' + stringify(folder.name));
        if (folder.name.toLowerCase().includes(settings.searchFilter)) {
          html.css({remove:['remove']});
          for (const check of folder.checks) {
            html.query(`div [data-id="${check.id}"]`).css({remove:['hide']});
          }
        }
        else {
          // Apply search filter on checks
          html.css({add:['remove']});
          for (const check of folder.checks) {
            if (check.explanation.toLowerCase().includes(settings.searchFilter) || check.type.toLowerCase().includes(settings.searchFilter) || check.host.toLowerCase().includes(settings.searchFilter)) {
              html.css({remove:['remove']});
              html.query(`div [data-id="${check.id}"]`).css({remove:['hide']});
            }
            else {
              html.query(`div [data-id="${check.id}"]`).css({add:['hide']});
            }
          }
        }
      }
    }
    else {
      // Unapply search filter on all folders and checks
      for (const folder of Object.values(data.folders)) {
        const html = query('#' + stringify(folder.name));
        html.css({remove:['remove']});
        for (const check of folder.checks) {
          html.query(`div [data-id="${check.id}"]`).css({remove:['hide']});
        }
      }
    }
  }

  async function fetchText(name, url, requestInit) {
    try {
      const response = await fetch(url, requestInit);
      const text = await response.text();
      return text;
    }
    catch (reason) {
      throw Error(`Problem retrieving ${url} for ${name}. Webpage responded with ${reason.message}`);
    }
  }
 
  function readChecks(xml, datasource) {
    // Clear previous data
    for (const folder of Object.values(data.folders)) {
      folder.checks = folder.checks.filter(check => check.datasource !== datasource);
    }
    data.checks = data.checks.filter(check => check.datasource !== datasource);

    // Check if datasource is insync
    datasource.checks.lastUpdate = parseDate(dom(xml).query('monitor').query('xslrefreshtime').text());
    const datasourceInsync = new Date(Date.now() - settings.datasource.insyncInMinutes * 60 * 1000);
    if (datasource.checks.lastUpdate.getTime() > datasourceInsync.getTime()) {
      query('#ds-' + datasource.name)
        .css({add: ['success'], remove: ['error']});
    }
    else {
      query('#ds-' + datasource.name)
        .css({add: ['error'], remove: ['success']});

      showAlert({id: `alert-source-${datasource.name}` , text: `Outdated ${datasource.checks.url} for ${datasource.name}. Updated ${datasource.checks.lastUpdate}.`});
    }
    query('#ds-' + datasource.name)
      .query('.text')
        .prop('title', () => `Checks:\n${datasource.checks.url}\n${datasource.checks.lastUpdate}\n\nAvailability:\n${datasource.availability.url}`);

    // Read data for each check
    browser.console.debug(`Reading datasource checks for ${datasource.name}. Updated ${datasource.checks.lastUpdate}.`);
    const checks = dom(xml).query('monitor').query('check');
    checks.each((elem) => {
      const check = {
        datasource:     datasource,
        id:             elem.query('id').text(),
        host:           elem.query('host').text(),
        displayname:    elem.query('displayname').text(),
        explanation:    elem.query('explanation').text(),
        folder:         elem.query('folder').text(),
        result:         elem.query('result').text(),
        data:           elem.query('data').text(),
        type:           elem.query('type').text(),
        uptimeSuccess:  '0.00'
      };

      // Append check to given folder
      if (check.folder.toLowerCase().startsWith(settings.ignoreFolderName) === false) {
        data.checks.push(check);
        if (data.folders[check.folder] === undefined) {
          data.folders[check.folder] = { name: check.folder, checks: [], uptime: '0.00' };
        }
        data.folders[check.folder].checks.push(check);
      }
    });
  }

  function readAvailability(xml, datasource) {
    // Calculate availability interval (in days)
    const fromDate = parseDate(dom(xml).query('monitor').query('from-date').text());
    const toDate = parseDate(dom(xml).query('monitor').query('to-date').text());
    datasource.availability.spanInDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
    datasource.availability.lastUpdate = toDate;

    query('#ds-' + datasource.name)
      .query('.text')
        .prop('title', () => `Checks:\n${datasource.checks.url}\n${datasource.checks.lastUpdate}\n\nAvailability:\n${datasource.availability.url}\n${datasource.availability.lastUpdate}`);

    browser.console.debug(`Reading datasource availability for ${datasource.name}. Updated ${datasource.availability.lastUpdate}.`);

    // Group checks by folder
    const checks = data.checks.filter(check => check.datasource === datasource);
    const checksById = checks.reduce((sum,check) => {
      if (sum[check.id] === undefined) {
        sum[check.id] = [];
      }
      sum[check.id].push(check);
      return sum;
    }, {});

    // Assign least uptime to folder
    dom(xml).query('monitor').query('check').each((elem) => {
      const id = elem.query('id').text();
      if (checksById[id] !== undefined) {
        const value = elem.query('success-pct').text();
        if (value && value.indexOf('%') !== -1) {
          const check = checksById[id][0];
          check.uptimeSuccess = value.slice(0, value.length - 1);
          query('#' + stringify(check.folder) + '_' + check.id)
            .prop('title', () => `Host: ${check.host}\nUptime: ${check.uptimeSuccess}\nCheck: ${check.type}\nResult: ${check.result}\n\n${check.explanation}`);
        }
      }
    });
    
    // Assign each folder its checks lowest availability
    for (const folder of Object.values(data.folders)) {
      const checks = folder.checks.filter(check => check.result !== 'On Hold');
      const percent = checks.reduce(
        (sum, check) => {
          const a = fromFloat(sum);
          const b = fromFloat(check.uptimeSuccess);
          if (a < b) {
            return sum;
          }
          return check.uptimeSuccess;
        },
        "100.00"
      );
      folder.uptime = percent;
    }
  }

  function showAvailability(datasource) {
    for (const folder of Object.values(data.folders)) {
      folder.htmlUptime.empty();
      folder.htmlUptime
        .append(
          div({attrs: ['progress-bar']})
            .attr('width', () => folder.uptime + '%')
            .append(span({props: {textContent: `${folder.uptime} % (last ${datasource.availability.spanInDays} days)`}}))
        );
    }
  }
  
  function showChecks() {
    query('#checks').empty();
    
    // Group folders by checks result
    const byStatus = Object.values(data.folders).reduce((sum,folder) => {
      if(folder.checks.every(check => check.result === 'On Hold')) {
        sum['Onhold'].push(folder);
      }
      else if (folder.checks.every(check => check.result === 'Successful' || check.result === 'Uncertain' || check.result === 'On Hold') ) {
        sum['Ok'].push(folder);
      }
      else if (folder.checks.every(check => check.result === 'Failed')) {
        sum['Error'].push(folder); 
      }
      else {
        sum['Warning'].push(folder);
      }
      return sum;
    }, {'Ok':[], 'Warning': [], 'Error':[], 'Onhold': []});
    
    byStatus['Ok'] ? query('#statusUpText').text(byStatus['Ok'].length) : query('#statusUpText').text('0');
    byStatus['Warning'] ? query('#statusWarnText').text(byStatus['Warning'].length) : query('#statusWarnText').text('0');
    byStatus['Error'] ? query('#statusDownText').text(byStatus['Error'].length) : query('#statusDownText').text('0');

    if (byStatus['Error']) { showFolders(byStatus['Error'], 'Error'); }
    if (byStatus['Warning']) { showFolders(byStatus['Warning'], 'Warning'); }
    if (byStatus['Ok']) { showFolders(byStatus['Ok'], 'Ok'); }
    if (byStatus['Onhold']) { showFolders(byStatus['Onhold'], 'Onhold'); }
  }

  function showFolders(folders, result) {
    for (const folder of Object.values(folders)) {
      showFolder(folder, result);
    }
  }

  function showFolder(folder, result) {
    const html = div({props:{id: stringify(folder.name)}, attrs:['item','card','mx-2','my-2']});
    folder.htmlUptime = div({attrs:['progress', 'uptime']});

    if (result === "Ok") { html.css({add:['bg-success']}); }
    else if (result === "Error") { html.css({add:['bg-danger']}); }
    else if (result === "Onhold") { html.css({add:['bg-info']}); }
    else { html.css({add:['bg-warning']}); }

    const byType = folder.checks.reduce((sum,check) => {
      if (sum[check.type] === undefined) {
        sum[check.type] = [];
      }
      sum[check.type].push(check);
      return sum;
    }, {});

    const htmlData = div({attrs:['data-table']});

    for (const [name,checks] of Object.entries(byType)) {
      for (const check of Object.values(checks)) {
        showCheck(check, name, htmlData);
      }
    }
    
    html.append(
      div({attrs:['card-body','mx-1','my-1','px-1','py-0']})
        .append(div({props:{textContent: folder.name}, attrs: ['card-title','my-1']}))
        .append(folder.htmlUptime)
        .append(htmlData)
    );
    folder.html = html;
    
    query('#checks').append(html);
  }

  function showCheck(check, key, html) {
    const name = clip(key, settings.layout.textColumnWidth.name, '..');
    const detail = clip(extractText(check.explanation, 'Service [', ']'), settings.layout.textColumnWidth.detail, '..');
    const host = clip(check.host.toLowerCase(), settings.layout.textColumnWidth.host, '..');

    // Add status column
    const htmlStatus = span({attrs: ['btn-sm','icon'], datas:{'id': check.id}});
    if (check.result === 'Successful') {
      htmlStatus.text('');
    }
    else if (check.result === 'Uncertain') {
      htmlStatus.text('');
    }
    else if (check.result === 'On Hold') {
      htmlStatus.text('');
    }
    else {
      htmlStatus.text('');
    }
    html.append(htmlStatus);
    
    // Add name column
    html.append(span({props:{textContent: name}, datas:{'id': check.id}}));
    
    // Add value column
    if (key === 'CPU Usage') {
      showProgress('' + check.data, check.result, html, check.id);
    }
    else if (key === 'Memory Usage') {
      const minMem = parseFloat(extractText(check.explanation, 'minimum required=[', ' '));
      const freeMem = parseFloat(check.data);
      const value = freeMem < minMem ? 100.0 : (1.0 / (freeMem / minMem)) * 100.0;
      showProgress(value.toFixed(0), check.result, html, check.id);
    }
    else {
      html.append(span({props:{textContent: detail}, datas:{'id': check.id}}));
    }
    
    // Add host column (with tooltip)
    html.append(
      span({
        props: {
          id: stringify(check.folder) + '_' + check.id,
          textContent: host,
          title:`Host: ${check.host}\nUptime: ${check.uptimeSuccess}\nCheck: ${check.type}\nResult: ${check.result}\n\n${check.explanation}`
        },
        datas:{'id': check.id}
      })
    );
  }

  function showProgress(percent, result, html, id) {
    html.append(
      div({attrs:['progress'], datas:{'id': id}})
        .append(
          div({attrs: ['progress-bar','bg-info']})
            .attr('width', () => String(percent) + '%')
        )
    );
  }

  function showAlert({id, text}) {
    browser.console.warn(text);
    const alerts = query('#alerts');
    query('#' + id).remove();
    alerts.append(
      div({props: {id:id}, attrs: ['alert','alert-secondary','float-right','w-25','m-1','px-1','py-0']})
        .append(
          element({type:'button', attrs:['close','noselect','float-right']})
            .append(span({props:{innerHTML:'&times;'}, attrs:['noselect']}))
            .event('click', (event) => query('#' + id).remove(), {passive: true})
        )
        .append(span({props:{textContent: text}}))
    );
  }


  /*
   *  Text utility
  */

  function clip(str,length,pad) { return (str.length < length) ? (str) : (str.substr(0,length-pad.length) + pad); }

  function fromFloat(value, elseValue = '0.00') { try { return parseFloat(value); } catch(exp) { return elseValue; } }

  function stringify(str) { return str.toLowerCase().replace(/\\/g,'_').replace(/ /g,'_').replace(/\./g,'_'); }

  function extractText(text, from, to) {
    if (text.toLowerCase().includes(from.toLowerCase())) {
      const splitText = text.split(from, 2)[1];
      if (splitText.toLowerCase().includes(to.toLowerCase())) {
        return splitText.split(to, 1)[0];
      }
    }
    else {
      return text;
    }
  }

  function parseDate(str) {
    const ts = {
      year: 0, month: 0, day: 0,
      hour:0 , min: 0, sec: 0
    };

    const dateText = str.includes(' ') ? (str.split(' ', 2)[0]) : ('');
    const timeText = str.includes(' ') ? (str.split(' ', 2)[1]) : ('');

    if (dateText.includes('.')) {
      ts.year = parseInt(dateText.split('.')[2]);
      ts.month = parseInt(dateText.split('.')[1]) - 1;
      ts.day = parseInt(dateText.split('.')[0]);
    }
    else if (dateText.includes('/'))
    {
      ts.year = parseInt(dateText.split('/')[2]);
      ts.month = parseInt(dateText.split('/')[0]) - 1;
      ts.day = parseInt(dateText.split('/')[1]);
    }
    if (timeText.includes(':')) {
      ts.hour = parseInt(timeText.split(':')[0]);
      ts.min = parseInt(timeText.split(':')[1]);
      ts.sec = parseInt(timeText.split(':')[2]);

      if (timeText.split(' ', 2).length > 1) {
        const period = timeText.split(' ', 2)[1].toLowerCase();
        if (period === 'pm') {
          ts.hour = ts.hour + 12;
        }
      }
    }

    return new Date(ts.year, ts.month, ts.day, ts.hour, ts.min, ts.sec);
  }


  /*
   *  DOM util
   */
  function layoutGrid(gridBody, gridElems) {
    gridElems.each((elem) => {
      let rowgap,rowheight,marginTop,marginBottom,scrollheight;
      gridBody
        .attr('grid-auto-rows', (value)  => rowheight = parseInt(value))
        .attr('grid-row-gap', (value) => rowgap = parseInt(value));
      elem
        .attr('margin-top', (value) => marginTop = parseInt(value))
        .attr('margin-bottom', (value) => marginBottom = parseInt(value));
      elem.prop('scrollHeight', (value) => scrollheight = value);
      elem.attr('grid-row-end', () => 'span ' + Math.ceil((scrollheight + marginTop + marginBottom + rowgap) / (rowheight + rowgap)))
    });
  }

  function parseXml(text) {
    const parser = new DOMParser();
    return parser.parseFromString(text, "application/xml");
  }

  function dom(elem) {
    return new ElementSeq([elem]);
  }


  function query(selector) {
    const matches = browser.document.querySelectorAll(selector);
    return new ElementSeq(Array.from(matches));
  }

  function element({type, props, attrs, datas}) {
    const elem = browser.document.createElement(type);
    if (props !== undefined) {
      for (const [key, value] of Object.entries(props)) {
        elem[key] = value;
      }
    }
    if (attrs !== undefined) {
      elem.classList.add(...attrs);
    }
    if (datas !== undefined) {
      for (const [key, value] of Object.entries(datas)) {
        elem.dataset[key] = value;
      }
    }
    return new ElementSeq([elem]);
  }

  function div({props,attrs,datas}) {
    return element({type:'div', props:props, attrs:attrs, datas:datas});
  }

  function span({props,attrs,datas}) {
    return element({type:'span', props:props, attrs:attrs, datas:datas});
  }
  
})(window, (function(browser) {

  /*
   *  Element util
   */
  class ElementSeq {
    constructor(elems) {
      if (elems === undefined) {
        this.elems = [];
      }
      else if (elems === null) {
        throw Error('Constructor parameter elems cannot be null');
      }
      else {
        this.elems = elems;
      }
    }

    append(other) {
      for (const elem of this.elems) {
        for (const otherElem of other.elems) {
          elem.appendChild(otherElem);
        }
      }
      return this;
    }

    css({add, remove}) {
      for (const elem of this.elems) {
        if (add) {
          elem.classList.add(...add);
        }
        if (remove) {
          elem.classList.remove(...remove);
        }
      }
      return this;
    }

    each(fn) {
      for (const elem of this.elems) {
        fn(new ElementSeq([elem]));
      }
      return this;
    }

    empty() {
      for (const elem of this.elems) {
        elem.innerHTML = '';
      }
      return this;
    }

    remove() {
      for (const elem of this.elems) {
        elem.parentNode.removeChild(elem);
      }
      return this;
    }

    size() {
      return this.elems.length;
    }

    prop(key, fn) {
      for (const elem of this.elems) {
        if (fn.length === 0) {
          elem[key] = fn();
        }
        else {
          fn(elem[key]);
        }
      }
      return this;
    }

    attr(key, fn) {
      for (const elem of this.elems) {
        if (fn.length === 0) {
          elem.style[key] = fn();
        }
        else {
          if (elem.style[key] === undefined || elem.style[key] === '') {
            fn(browser.getComputedStyle(elem) ? browser.getComputedStyle(elem)[key] : "");
          }
          else {
            fn(elem.style[key]);
          }
        }
      }
      return this;
    }

    data(key, fn) {
      for (const elem of this.elems) {
        if (fn.length === 0) {
          elem.dataset[key] = fn();
        }
        else {
          fn(elem.dataset[key]);
        }
      }
      return this;
    }

    event(name, fn, options) {
      for (const elem of this.elems) {
        elem.addEventListener(name, fn, options | {});
      }
      return this;
    }

    text(value) {
      for (const elem of this.elems) {
        if (value === undefined) {
          return elem.textContent;
        }
        else {
          elem.textContent = value;
        }
      }
      return this;
    }

    query(selector) {
      const matches = [];
      for (const elem of this.elems) {
        matches.push(Array.from(elem.querySelectorAll(selector)));
      }
      return new ElementSeq([].concat(...matches));
    }
  }

  return ElementSeq;
}(window))
);