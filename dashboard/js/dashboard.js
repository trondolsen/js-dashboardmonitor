/***
 * Dashboard for ActiveExperts
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
  'use strict';

  const config = {
    title: 'Applications',
    searchFilters: [],
    ignoreFolderName: '\\_',
    clearConsoleInMinutes: 30,
    layout: {columnWidth: { name: 17, host: 18, detail: 19 }},
    datasource: {
      updateInMinutes: 1,
      insyncInMinutes: 5,
      requestInit: {cache: 'no-cache', mode: 'same-origin', credentials: 'same-origin'},
      sources: [
        {name: 'ExampleData', enabled: true, checks: {url: 'ExampleChecks.xml'}, availability: {url: 'ExampleAvailabilty.xml'}}
      ],
      checkRating: {
        'default': 1,
        'Citrix XenApp': 1,
        'CPU': 1,
        'DNS': 1,
        'Event Log': 1,
        'Event Log (Classic)': 1,
        'HTTP(s)': 1,
        'ICMP': 1,
        'Memory': 1,
        'MS SQL Server': 1,
        'Powershell': 1,
        'Service': 1,
        'SMTP': 1,
        'SNMP Get': 1
      }
    }
  };
  const data = {folders: {}, checks: []};

  const applyConfig = () => new Promise((resolve) => {
    // Handle URL parameters
    var searchParams = new URLSearchParams(browser.window.location.search);

    if (searchParams.has('search')) {
      config.searchFilters = searchParams.get('search').split(' ').map(item => item.toLowerCase());
      query('.navbar .searchbar .form-control').prop('value', () => config.searchFilters.join('+'));
      browser.console.info(`search=${config.searchFilters.join('+')}`);
    }
    if (searchParams.has('datasources')) {
      const datasourcesParams = searchParams.get('datasources').split(' ');
      config.datasource.sources.forEach((source) => {
        source.enabled = false;
        datasourcesParams.forEach((sourceParam) => {
           if (source.name.toLowerCase() === sourceParam.toLowerCase()) {
            source.enabled = true;
          }
        });
      });
      browser.console.info(`datasources=${datasourcesParams.join('+')}`);
     }

    // Handle grid layout resizing
    dom(browser)
      .event('resize', () => {
        layoutGrid(query('#checks'), query('.card'));
        query('.navbar').prop('scrollHeight', (value) => dom(browser.document.body).attr('padding-top', () => value + "px"));
        query('.navbar').prop('scrollHeight', (value) => query('#alerts').attr('padding-top', () => value + "px"));
      });

    dom(browser.document)
      .event('DOMContentLoaded', () => {
        layoutGrid(query('#checks'), query('.card'));
        query('.navbar').prop('scrollHeight', (value) => dom(browser.document.body).attr('padding-top', () => value + "px"));
        query('.navbar').prop('scrollHeight', (value) => query('#alerts').attr('padding-top', () => value + "px"));
      });

    // Set title
    query('.navbar .topbar .text').text(config.title);
    dom(browser.document).prop('title', () => config.title);

    // Handle search text
    query('.navbar .searchbar .form-control')
      .event('keyup', (event) => {
        browser.scrollTop = 0;
        config.searchFilters = [];
        if (event.target.value.length > 0) {
          config.searchFilters = event.target.value.split('+').map(item => item.toLowerCase());
        }
        filterChecks();
        layoutGrid(query('#checks'), query('.card'));
      })
      .event('keypress', (event) => {
        if (event.keyCode == 13) {
          event.preventDefault();
        }
      });

    // Show datasources
    for (const source of config.datasource.sources) {
      query('#datasources')
        .append(
          span({props: {id: 'ds-' + source.name}, css: ['datasource']})
            .append(span({props: {textContent: ''}, css: ['icon','mx-1']}))
            .append(span({props: {textContent: source.name, title: `${source.checks.url}\n${source.availability.url}`}, css: ['text','datasource-tooltip']}))
            .event('click', () => {
              if (source.enabled) {
                source.enabled = false;
                query('#ds-' + source.name)
                  .css({add: ['disabled']});
                }
              else {
                source.enabled = true;
                query('#ds-' + source.name)
                  .css({remove: ['disabled']});
              }
              filterChecks();
              layoutGrid(query('#checks'), query('.card'));
          })
        );
    }

    // Repeated fetching of datasources
    const fetchSources = () => {
      const sources = config.datasource.sources.filter((source) => source.enabled);
      Promise.all(
        sources.map(async (source) => {
          try {
            const checksData = fetchText(source.name, source.checks.url, config.datasource.requestInit);
            const availabilityData = fetchText(source.name, source.availability.url, config.datasource.requestInit);
            readChecks(parseXml(await checksData), source);
            showChecks();
            layoutGrid(query('#checks'), query('.card'));
            filterChecks();
            readAvailability(parseXml(await availabilityData), source);
            showAvailability(source);
          }
          catch (reason) {
            browser.console.error(`Error processing datasource ${source.name}. ${reason.message}`);
          }
        })
      );
    };
    browser.setInterval(fetchSources, config.datasource.updateInMinutes * 60 * 1000);
    fetchSources();

    // Clear console at regular intervals
    browser.setInterval(() => { browser.console.clear(); }, config.clearConsoleInMinutes * 60 * 1000);

    resolve();
  });

  applyConfig()
    .then(() => {
      browser.console.info(`Dashboard started. Fetching datasource(s) at ${config.datasource.updateInMinutes} minute interval.`);
    })
    .catch((reason) => {
      browser.console.error(`Dashboard initialization failed. ${reason.message}`);
    });

  function filterChecks() {
    if (config.searchFilters.length > 0 ) {
      // Apply search filter on folders
      for (const folder of Object.values(data.folders)) {
        const html = query('#' + stringify(folder.name));
        const nameTest = config.searchFilters.length > 0 && config.searchFilters.reduce((acc,item) => folder.name.toLowerCase().includes(item) && acc, true);
        if (nameTest) {
          html.css({remove:['remove']});
          for (const check of folder.checks) {
            html.query(`div [data-id="${check.id}"]`).css({remove:['hide']});
          }
        }
        else {
          // Apply search filter on checks
          html.css({add:['remove']});
          for (const check of folder.checks) {
            const text = check.explanation.toLowerCase() + check.type.toLowerCase() + check.host.toLowerCase();
            const textTest = config.searchFilters.length > 0 && config.searchFilters.reduce((acc,item) => text.includes(item) && acc, true);
            if (textTest && check.datasource.enabled) {
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
          if (check.datasource.enabled) {
            html.query(`div [data-id="${check.id}"]`).css({remove:['hide']});
          }
          else {
            html.query(`div [data-id="${check.id}"]`).css({add:['hide']});
          }
        }
        // Folder with all checks from disabled datasources are hidden
        if (folder.checks.every(item => item.datasource.enabled === false)) {
          html.css({add:['remove']});
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
    const datasourceInsync = new Date(Date.now() - config.datasource.insyncInMinutes * 60 * 1000);
    clearAlert({id: `alert-source-${datasource.name}`});
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
      .prop('title', () => `${datasource.checks.url}\n${datasource.checks.lastUpdate}\n${datasource.availability.url}`);

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
        successPct:     '0.00',
        failurePct:     '0.00',
        uncertainPct:   '0.00',
        maintenancePct: '0.00',
        notprocessedPct:'0.00',
        success:        '0.00',
        failure:        '0.00',
        rating:         config.datasource.checkRating['default'],
      };

      // Assign rating for check type
      if (config.datasource.checkRating[check.type] !== undefined) {
        check.rating = config.datasource.checkRating[check.type];
      }

      // Append check to given folder
      if (check.folder.toLowerCase().startsWith(config.ignoreFolderName) === false) {
        data.checks.push(check);
        if (data.folders[check.folder] === undefined) {
          data.folders[check.folder] = { name: check.folder, checks: [], success: '100.00', warning: '0.00', error: '0.00' };
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
      .prop('title', () => `${datasource.checks.url}\n${datasource.checks.lastUpdate}\n${datasource.availability.url}\n${datasource.availability.lastUpdate}`);

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

    // Assign average success to folder
    dom(xml).query('monitor').query('check').each((elem) => {
      const id = elem.query('id').text();
      if (checksById[id] !== undefined) {
        const check = checksById[id][0];
        check.successPct = elem.query('success-pct').text().slice(0,-1);
        check.failurePct = elem.query('failure-pct').text().slice(0,-1);
        check.uncertainPct = elem.query('uncertain-pct').text().slice(0,-1);
        check.maintenancePct = elem.query('maintenance-pct').text().slice(0,-1);
        check.notprocessedPct = elem.query('notprocessed-pct').text().slice(0,-1);
        check.success = ((fromFloat(check.successPct) * 10 + fromFloat(check.uncertainPct) * 10 + fromFloat(check.maintenancePct) * 10 + fromFloat(check.notprocessedPct) * 10) / 10).toFixed(2);
        check.failure = check.failurePct;
        query('#' + stringify(check.folder) + '_' + check.id)
          .prop('title', () => `Host: ${check.host}\nSuccess: ${check.successPct}%\nFailure: ${check.failurePct}%\nUncertain: ${check.uncertainPct}%\nMaintenance: ${check.maintenancePct}%\nNot Processed: ${check.notprocessedPct}%\nType: ${check.type}\nRating: ${check.rating}\nResult: ${check.result}\n\n${check.explanation}`);
      }
    });

    for (const folder of Object.values(data.folders)) {
      const checks = folder.checks.filter(check => check.result !== 'On Hold' || check.result !== 'Maintenance');
      const sum = checks.reduce((sum, check) => sum + fromFloat(check.success) * check.rating, 0.00);
      if (sum > 0.0) {
        const ratings = checks.reduce((sum, check) => sum + check.rating, 0.00);
        folder.success = (sum / ratings).toFixed(2);
      }
    }
  }

  function showAvailability(datasource) {
    for (const folder of Object.values(data.folders)) {
      folder.htmlStatus
        .empty()
        .append(
          div({attrs:{width: folder.success + '%'}, css: ['progress-bar']})
          .append(span({props: {textContent: `${folder.success} % (last ${datasource.availability.spanInDays} days)`}}))
        );
    }
  }
  
  function showChecks() {
    query('#checks').empty();
    
    // Group folders by checks result
    const byStatus = Object.values(data.folders).reduce((sum,folder) => {
      if(folder.checks.every(check => check.result === 'On Hold' || check.result === 'Maintenance')) {
        sum['Onhold'].push(folder);
      }
      else if (folder.checks.every(check => check.result === 'Successful' || check.result === 'Uncertain' || check.result === 'On Hold' || check.result === 'Maintenance') ) {
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
    const html = div({props:{id: stringify(folder.name)}, css:['item','card','mx-2','my-2']});

    folder.htmlStatus = div({css:['progress', 'uptime']});

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

     const htmlData = div({css:['data-table']});

    for (const [name,checks] of Object.entries(byType)) {
      for (const check of Object.values(checks)) {
        showCheck(check, name, htmlData);
      }
    }
    
    html.append(
      div({css:['card-body','mx-1','my-1','px-1','py-0']})
        .append(div({props:{textContent: folder.name}, css: ['card-title','my-1']}))
        .append(folder.htmlStatus)
        .append(htmlData)
    );
    folder.html = html;
    
    query('#checks').append(html);
  }

  function showCheck(check, key, html) {
    const name = clip(key, config.layout.columnWidth.name, '..');
    const detail = clip(extractText(check.explanation, 'Service [', ']'), config.layout.columnWidth.detail, '..');
    const host = clip(check.host.toLowerCase(), config.layout.columnWidth.host, '..');

    // Add status column
    const htmlStatus = span({css: ['btn-sm','icon'], datas:{'id': check.id}});
    if (check.result === 'Successful') {
      htmlStatus.text('');
    }
    else if (check.result === 'Uncertain') {
      htmlStatus.text('');
    }
    else if (check.result === 'On Hold') {
      htmlStatus.text('');
    }
    else if (check.result === 'Maintenance') {
      htmlStatus.text('');
    }
    else {
      htmlStatus.text('');
    }
    html.append(htmlStatus);
    
    // Add name column
    html.append(span({props:{textContent: name}, datas:{'id': check.id}}));
    
    // Add value column
    if (key === 'CPU Usage') {
      showProgress(String(check.data), check.result, html, check.id);
    }
    else if (key === 'Memory Usage') {
      const minMem = fromFloat(extractText(check.explanation, 'minimum required=[', ' '));
      const freeMem = fromFloat(check.data);
      const value = freeMem < minMem ? 100.0 : (1.0 / (freeMem / minMem)) * 100.0;
      showProgress(value.toFixed(0), check.result, html, check.id);
    }
    else if (key === 'Event Log') {
      html.append(span({props:{textContent: (check.data === '0' ? detail : check.data + ' matches')}, datas:{'id': check.id}}));
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
          title:`Host: ${check.host}\nSuccess: ${check.successPct}\nType: ${check.type}\nRating: ${check.rating}\nResult: ${check.result}\n\n${check.explanation}`
        },
        datas:{'id': check.id}
      })
    );
  }

  function showProgress(percent, result, html, id) {
    html.append(
      div({css:['progress'], datas:{'id': id}})
        .append(
          div({attrs: {width: String(percent) + '%'}, css: ['progress-bar','bg-info']})
        )
    );
  }

  function clearAlert({id}) {
    query('#' + id).remove();
  }

  function showAlert({id, text}) {
    browser.console.warn(text);
    const alerts = query('#alerts');
    alerts.append(
      div({props: {id:id}, css: ['alert','alert-secondary','float-right','w-25','m-1','px-1','py-0']})
        .append(
          element({type:'button', css:['close','noselect','float-right']})
            .append(span({props:{innerHTML:'&times;'}, css:['noselect']}))
            .event('click', () => query('#' + id).remove(), {passive: true})
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
    let rowgap='',rowheight='';
    gridBody
      .attr('grid-auto-rows', (value) => rowheight = parseInt(value))
      .attr('grid-row-gap', (value) => rowgap = parseInt(value));

    gridElems.each((elem) => {
      let marginBottom='',marginTop='',scrollheight='';
      elem
        .attr('margin-top', (value) => marginTop = parseInt(value))
        .attr('margin-bottom', (value) => marginBottom = parseInt(value));
      elem.prop('scrollHeight', (value) => scrollheight = value);
      elem.attr('grid-row-end', () => 'span ' + Math.ceil((scrollheight + marginTop + marginBottom + rowgap) / (rowheight + rowgap)));
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

  function element({type, props, attrs, css, datas}) {
    const elem = browser.document.createElement(type);
    if (props !== undefined) {
      for (const [key, value] of Object.entries(props)) {
        elem[key] = value;
      }
    }
    if (attrs !== undefined) {
      for (const [key, value] of Object.entries(attrs)) {
        elem.style[key] = value;
      }
    }
    if (css !== undefined) {
      elem.classList.add(...css);
    }
    if (datas !== undefined) {
      for (const [key, value] of Object.entries(datas)) {
        elem.dataset[key] = value;
      }
    }
    return new ElementSeq([elem]);
  }

  function div({props,attrs,css,datas}) {
    return element({type:'div', attrs:attrs, props:props, css:css, datas:datas});
  }

  function span({props,attrs,css,datas}) {
    return element({type:'span', attrs:attrs, props:props, css:css, datas:datas});
  }
  
})(window, (function(browser) {
  'use strict';

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
        if (remove) {
          elem.classList.remove(...remove);
        }
        if (add) {
          elem.classList.add(...add);
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
        elem.addEventListener(name, fn, options || {});
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