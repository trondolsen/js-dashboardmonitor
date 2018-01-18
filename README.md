# Dashboard for ActiveXperts Network Monitor

Web-based dashboard for displaying checks exported from ActiveXperts Network Monitor (see www.activexperts.com).

![Screenshot](README.png "Screenshot")

## Features

* Live updates
* Search
* Supports multiple installations of ActiveXperts Network Monitor

## Installation

Manually copy `dashboard.html` and `\dashboard` to `%PROGRAMDATA%\ActiveXperts\Network Monitor\Web`
* For demo purpose also copy the example files `ExampleChecks.xml` and `ExampleAvailability.xml` to `%PROGRAMDATA%\ActiveXperts\Network Monitor\Web`

Prepare datasource files in ActiveXperts Network Monitor
* Use customized report to defined interval for checks data
* Use scheduled task to generate availability data at regular intervals
* See https://www.activexperts.com/files/network-monitor/manual.htm#Report_Module for details

Configure datasource(s) in `%PROGRAMDATA%\ActiveXperts\Network Monitor\Web\dashboard\js\dashboard.js` with url for given checks and availability xml file
```javascript
const settings = {
  datasource: {
      sources: [
        {name: 'ExampleData', checks: {url: 'ExampleChecks.xml'}, availability: {url: 'ExampleAvailabilty.xml'}}
      ]
    }
  };
```

## Usage

Open http://\<ip:port\>/dashboard.html in web browser.

Web browser requirements:
 - ECMAScript 2017 (http://www.ecma-international.org/ecma-262/8.0/index.html)
 - CSS Grid (https://www.w3.org/TR/css-grid-1/)

## History

See [HISTORY.md](https://github.com/trondolsen/js-monitordashboard/blob/master/HISTORY.md)

## Credits

Trond Olsen, trond@steinbit.org, Norway

## License

MIT License

Copyright (c) 2017-2018 Trond Olsen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Dependencies

This software was built using these additional libraries.

### Bootstrap 4.0.0

https://getbootstrap.com/

The MIT License (MIT)

Copyright (c) 2011-2018 Twitter, Inc.
Copyright (c) 2011-2018 The Bootstrap Authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
