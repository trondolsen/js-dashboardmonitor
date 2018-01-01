/***
 * Dashboard for ActiveExperts
 * 
 * Version: 0.6
 *
 * Copyright (c) 2017 Trond Olsen
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
    clearConsoleInMinutes: 15,
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
    dom(browser).event('resize', () => layoutGrid(query('#checks'), query('.card')));
    dom(browser.document).event('ready', () => layoutGrid(query('#checks'), query('.card')));

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
          return false;
        }
      });

    // Show datasources
    for (const source of settings.datasource.sources) {
      query('#datasources')
        .append(span({id: 'ds-' + source.name, css: ['datasource']})
          .append(span({css: ['icon','mx-1'], text: '' }))
          .append(span({css: ['text','datasource-tooltip'], text: source.name, title: `${source.name}\nChecks URL: ${source.checks.url}\nAvailability URL: ${source.availability.url}`}))
      );
    }

    // Trigger repeated fetching of datasources
    browser.console.info(`Dashboard started. Fetching datasource(s) at ${settings.datasource.updateInMinutes} minute interval.`);
    for (const source of settings.datasource.sources) {
      const fetchData = async () => {
        try {
          const checksData = fetchText(source.name, source.checks.url, settings.datasource.requestInit);
          const availabilityData = fetchText(source.name, source.availability.url, settings.datasource.requestInit);
          readChecks(parseXml(await checksData), source);
          showChecks();
          filterChecks();
          layoutGrid(query('#checks'), query('.card'));
          readAvailability(parseXml(await availabilityData), source);
          showAvailability(source);
        }
        catch (reason) {
          showAlert({id: `alert-source-${source.name}`, text: reason.message });
        }
      };
      browser.setInterval(fetchData, settings.datasource.updateInMinutes * 60 * 1000);
      fetchData();
    }

    // Trigger clearing of console
    browser.setInterval(() => { browser.console.clear(); }, settings.clearConsoleInMinutes * 60 * 1000);
  })();

  function filterChecks() {
    if (settings.searchFilter.length > 0 ) {
      // Apply search filter on folders
      for (const folder of Object.values(data.folders)) {
        const html = query('#' + stringify(folder.name));
        if (folder.name.toLowerCase().includes(settings.searchFilter)) {
          html.css({remove:['remove']});
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
      throw Error(`Problem retrieving ${name} from ${url}. Webpage responded with ${reason.message}`);
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

      showAlert({id: `alert-source-${datasource.name}` , text: `Outdated ${datasource.name} from ${datasource.checks.url}. Updated ${datasource.checks.lastUpdate}.`});
    }
    query('#ds-' + datasource.name)
      .query('.text')
        .prop('title', `Checks:\n${datasource.checks.url}\n${datasource.checks.lastUpdate}\n\nAvailability:\n${datasource.availability.url}`);

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
        .prop('title', `Checks:\n${datasource.checks.url}\n${datasource.checks.lastUpdate}\n\nAvailability:\n${datasource.availability.url}\n${datasource.availability.lastUpdate}`);

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
          query('#' + stringify(check.folder) + '_' + check.id).prop('title', `Host: ${check.host}\nUptime: ${check.uptimeSuccess}\nCheck: ${check.type}\nResult: ${check.result}\n\n${check.explanation}`);
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
          div({
            css: ['progress-bar'],
            width: folder.uptime + '%'
          })
            .append(span({text: `${folder.uptime} % (last ${datasource.availability.spanInDays} days)`}))
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
    const html = div({id: stringify(folder.name), css: ['item','card','mx-2','my-2']});
    folder.htmlUptime = div({css: ['progress', 'uptime']});

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

    const htmlData = div({css: ['data-table']});

    for (const [name,checks] of Object.entries(byType)) {
      for (const check of Object.values(checks)) {
        showCheck(check, name, htmlData);
      }
    }
    
    html.append(
      div({css: ['card-body','mx-1','my-1','px-1','py-0']})
        .append(div({css: ['card-title','my-1'], text: folder.name}))
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

    // Add check status
    const htmlStatus = span({'data-id': check.id, css: ['btn-sm','icon']});
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
    
    // Add check name
    html.append(span({text: name, 'data-id': check.id}));
    
    // Add check value
    if (key === 'CPU Usage') {
      const percent = extractText(check.explanation, 'CPU usage=[', '%]');
      showProgress(percent, check.result, html, check.id);
    }
    else {
      html.append(span({text: detail, 'data-id': check.id}));
    }
    
    // Add host value (with tooltip)
    html.append(
      span({
        id: stringify(check.folder) + '_' + check.id,
        text: host,
        title: `Host: ${check.host}\nUptime: ${check.uptimeSuccess}\nCheck: ${check.type}\nResult: ${check.result}\n\n${check.explanation}`,
        'data-id': check.id
      })
    );
  }

  function showProgress(percent, result, html, id) {
    html.append(
      div({'data-id': id, css: ['progress']})
        .append(div({
          css: ['progress-bar','bg-info'],
          width: String(percent) + '%'
        }))
    );
  }

  function showAlert({id, text}) {
    browser.console.warn(text);
    const alerts = query('#alerts');
    clearAlert(id);
    alerts.append(
      div({id: id, css: ['alert',`alert-dark`,'float-right','w-25','m-1','px-1','py-0']})
        .append(
          button({type:'button', css:['close','float-right']})
            .append(span({css:['noselect'],html:'&times;'}))
            .event('click', (event) => {
              event.preventDefault();
              dom(event.target.parentNode).remove();
            })
        )
        .append(span({text: text}))
    );
  }

  function clearAlert(id) {
    query('#' + id).remove();
  }


  /*
   *  Text utility
  */

  function clip(str,length,pad) { return (str.length < length) ? (str) : (str.substr(0,length-pad.length) + pad); }

  function fromFloat(value, elseValue = '0.00') { try { return parseFloat(value); } catch(exp) { return elseValue; } }

  function stringify(str) { return str.toLowerCase().replace(/\\/g,'_').replace(/ /g,'_').replace(/\./g,'_'); }

  function extractText(text, from, to) {
    if (text.toLowerCase().startsWith(from.toLowerCase()) === true && text.toLowerCase().includes(to.toLowerCase())) {
      return text.split(from, 2)[1].split(to, 1)[0];
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
      const rowheight = parseInt(gridBody.attr('grid-auto-rows'));
      const rowgap = parseInt(gridBody.attr('grid-row-gap'));
      const margin = parseInt(elem.attr('margin-top')) + parseInt(elem.attr('margin-bottom'));
      const scrollHeight = elem.prop('scrollHeight');
      elem.attr('grid-row-end','span ' + Math.ceil((scrollHeight + margin + rowgap) / (rowheight + rowgap)));
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

  function element(type, attr) {
    const elem = browser.document.createElement(type);
    if (attr != undefined) {
      if (attr.id !== undefined) {
        elem.id = attr.id;
      }
      if (attr.title !== undefined) {
        elem.title = attr.title;
      }
      if (attr.text !== undefined) {
        elem.textContent = attr.text;
      }
      if (attr.width !== undefined) {
        elem.style.width = attr.width;
      }
      if (attr.css !== undefined) {
        elem.classList.add(...attr.css);
      }
      if (attr.html !== undefined) {
        elem.innerHTML = attr.html;
      }
      for (const [key, value] of Object.entries(attr)) {
        if (key.includes('data-')) {
          elem.dataset[key.substring(5)] = value;
        }
      }
    }
    return new ElementSeq([elem]);
  }

  function div(attr) {
    return element('div', attr);
  }

  function span(attr) {
    return element('span', attr);
  }

  function button(attr) {
    return element('button', attr);
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

    attr(key, value) {
      for (const elem of this.elems) {
        if(value === undefined) {
          if (elem.style[key] === undefined || elem.style[key] === '') {
            return browser.getComputedStyle(elem)[key];
          }
          return elem.style[key];
        }
        else {
          elem.style[key] = value;
        }
      }
      return this;
    }

    prop(key, value) {
      for (const elem of this.elems) {
        if(value === undefined) {
          return elem[key];
        }
        else {
          elem[key] = value;
        }
      }
      return this;
    }

    event(name, fn) {
      for (const elem of this.elems) {
        if (elem.addEventListener === undefined || elem.addEventListener === null) {
          elem['on' + name] = fn;
        }
        else {
          elem.addEventListener(name, fn);
        }
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