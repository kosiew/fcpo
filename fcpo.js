///ddtool/ ==UserScript==
// @name         Bursa enhancements
// @namespace    https://wpcomhappy.wordpress.com/
// @icon         https://raw.githubusercontent.com/soufianesakhi/feedly-filtering-and-sorting/master/web-ext/icons/128.png
// @version      1.7
// @description  Tool for enhancing Bursa
// @author       Siew "@xizun"
// @match        https://www.bursamalaysia.com/market_information/*
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @require      http://code.jquery.com/jquery-3.4.1.min.js
// @require      http://code.jquery.com/ui/1.12.1/jquery-ui.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// ==/UserScript==

(function ($) {
  //function to create private scope with $ parameter
  // FcpoPlus.js
  const TR_MONTH_INDEX = 2,
    TR_NAME_INDEX = 3,
    MONTH_INDEX = 6,
    MAX_MONTH_INDEX = 9,
    MAX_DAY_DIFFERENCE = 14;
  MAX_DAYS_DATA = 31;
  (WAIT_MILISECONDS = 600000),
    (CHANGE_THRESHOLD = 100),
    (NOTIFICATION_TITLE = "FCPO Alert"),
    (MORNING_START = 10.75),
    (MORNING_END = 12.75),
    (NOON_START = 14.75),
    (NOON_END = 18.26),
    (NIGHT_START = 21.25),
    (NIGHT_END = 23.75);

  const KEY = "FCPO";

  const _today = truncateDate(new Date()); // new Date(new Date().getFullYear(),new Date().getMonth() , new Date().getDate());
  const logMessagesElement = $('<h5 id="log-messages">log messages</h5>');
  const timerElement = $('<h5 id="timer">timer</h5>');

  const TR_INDICES = {
    1: "NAME",
    2: "MONTH",
    6: "LAST_DONE",
    12: "SETTLEMENT",
    8: "HIGH",
    9: "LOW",
    10: "VOLUME"
  };

  const options = {
    DEBUG: true
  };

  $.fn.multiline = function (text) {
    this.text(text);
    this.html(this.html().replace(/\n/g, "<br/>"));
    return this;
  };

  // for debugging
  const d = (function () {
    const debug = false;
    const messages = [];
    const MAX_LOG_MESSAGES = 5;

    function log(message, level = 0) {
      if (debug) {
        const styles = [
          "border: 1px solid #3E0E02",
          "color: white",
          "display: block",
          "text-shadow: 0 1px 0 rgba(0, 0, 0, 0.3)",
          "box-shadow: 0 1px 0 rgba(255, 255, 255, 0.4) inset, 0 5px 3px -5px rgba(0, 0, 0, 0.5), 0 -13px 5px -10px rgba(255, 255, 255, 0.4) inset",
          "line-height: 20px",
          "text-align: center",
          "font-weight: bold"
        ];

        if (level == 0) {
          styles.push("background: linear-gradient(#060dd3, #040647)");
        } else {
          styles.push("background: linear-gradient(#D33106, #571402)");
        }

        const _styles = styles.join(";");
        console.log(`%c ${message}`, _styles);
      }
      setLogMessage(message);
    }

    function setLogMessage(message) {
      if (messages.length > MAX_LOG_MESSAGES) {
        messages.shift();
      }
      messages.push(message);
      const msg = messages.join("\n");
      logMessagesElement.multiline(msg);
    }

    function group(groupName = "default") {
      if (debug) {
        console.group(groupName);
      }
    }

    function groupEnd() {
      if (debug) {
        console.groupEnd();
      }
    }

    function table(obj) {
      if (debug) {
        console.table(obj);
      }
    }

    return {
      log: log,
      group: group,
      groupEnd: groupEnd,
      table: table
    };
  })();

  const timer = (function () {
    let timerLoop;
    let timeoutLoop;

    let _timerElement;

    function register(element) {
      _timerElement = element;
    }

    function setTimeOut(action, f, timeout) {
      start(action, timeout / 1000);
      timeoutLoop = setTimeout(() => {
        f();
      }, timeout);
    }

    function start(action, timerSeconds) {
      let elapsedSeconds = parseInt(timerSeconds);
      timerLoop = setInterval(() => {
        elapsedSeconds--;
        const timeCountdown = new Date(elapsedSeconds * 1000)
          .toISOString()
          .substr(11, 8);
        _timerElement.text(`Countdown to ${action} : ${timeCountdown}`);
        if (elapsedSeconds < -5) {
          location.reload();
        } else if (elapsedSeconds <= 0) {
          clearInterval(timerLoop);
        }
      }, 1000);
    }

    function stop() {
      clearInterval(timerLoop);
      clearTimeout(timeoutLoop);
      _timerElement.text("Status: Stopped monitoring");
    }

    return {
      start,
      stop,
      register,
      setTimeOut
    };
  })();

  function jQueryIsLoaded() {
    return typeof $ == "function";
  }

  function isJquery(elem) {
    return elem instanceof jQuery && elem.length > 0;
  }

  function addBorder(elem) {
    elem.css("border", "2px solid red");
  }

  //private scope and using $ without worry of conflict
  d.log("loading Fcpo Plus");

  let selector =
    "#app > div > div.chat > div.chat__chat-queue > div.action-bar > div";

  function askNotificationPermission() {
    d.log("askNotificationPermission+");
    // function to actually ask the permissions
    function handlePermission(permission) {
      // Whatever the user answers, we make sure Chrome stores the information
      if (!("permission" in Notification)) {
        Notification.permission = permission;
      }
    }

    // Let's check if the browser supports notifications
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications.");
    } else {
      if (checkNotificationPromise()) {
        Notification.requestPermission().then((permission) => {
          handlePermission(permission);
        });
      } else {
        Notification.requestPermission(function (permission) {
          handlePermission(permission);
        });
      }
    }
  }
  function checkNotificationPromise() {
    try {
      Notification.requestPermission().then();
    } catch (e) {
      return false;
    }

    return true;
  }

  function notify(message) {
    const notification = new Notification(NOTIFICATION_TITLE, {
      body: message
    });
  }

  function getDecimalHours() {
    const d = new Date();
    const h = d.getHours();
    const m = d.getMinutes();

    const decimalHours = h + m / 60;
    return decimalHours;
  }

  function truncateDate(d) {
    const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return result;
  }
  // date2 - date1
  function getDayDifference(date1, date2 = _today) {
    // new Date(new Date().getFullYear(),new Date().getMonth() , new Date().getDate())
    const d1 = truncateDate(date1);
    const d2 = truncateDate(date2);
    const differenceInTime = d2 - d1;

    // To calculate the no. of days between two dates
    const differenceInDays = differenceInTime / (1000 * 3600 * 24);
    return differenceInDays;
  }

  const arr = (function () {
    function intersect(arrA, arrB) {
      const intersection = arrA.filter((x) => arrB.includes(x));
      return intersection;
    }

    // in arrA not in arrB
    function difference(arrA, arrB) {
      const _difference = arrA.filter((x) => !arrB.includes(x));
      return _difference;
    }

    function symmetricalDifference(arrA, arrB) {
      const _difference = arrA
        .filter((x) => !arrB.includes(x))
        .concat(arrB.filter((x) => !arrA.includes(x)));
      return _difference;
    }

    function union(arrA, arrB) {
      const _union = [...arrA, ...arrB];
      return _union;
    }

    return {
      union: union,
      symmetricalDifference: symmetricalDifference,
      difference: difference,
      intersect: intersect
    };
  })();

  /*
Solution of: https://www.codewars.com/kata/545434090294935e7d0010ab
source: https://gist.github.com/kopiro/4f75505a0c89269cf83ec5eacf6bae76
https://www.codewars.com/kata/545434090294935e7d0010ab/train/javascript

{
select: ...,
from: ...,
where: ...,
orderBy: ...,
groupBy: ...,
having: ...,
execute: ...
}

function aug(row) {
  return row.MONTH == 'Aug 2021';
}

query().select().from(data).where(aug).execute();
*/

  const query = function () {
    let self = {};

    let tables = [];
    let selector = null;

    let whereClauses = [];
    let havingClauses = [];

    let order = [];
    let group = [];

    let selectorAll = function (row) {
      return row;
    };

    self.select = function (e) {
      if (selector != null) throw new Error("Duplicate SELECT");
      selector = e || false;
      return self;
    };

    self.from = function () {
      if (tables.length > 0) throw new Error("Duplicate FROM");
      tables = Array.from(arguments);
      return self;
    };

    self.where = function () {
      whereClauses.push(Array.from(arguments));
      return self;
    };

    self.having = function () {
      havingClauses.push(Array.from(arguments));
      return self;
    };

    self.orderBy = function () {
      if (order.length > 0) throw new Error("Duplicate ORDERBY");
      order = Array.from(arguments);
      return self;
    };

    self.groupBy = function () {
      if (group.length > 0) throw new Error("Duplicate GROUPBY");
      group = Array.from(arguments);
      return self;
    };

    self.execute = function () {
      let tmpdata = [];
      let gdata = [];

      let data = [];
      let t = 0;

      // JOIN

      if (tables.length > 1) {
        tables.forEach(function () {
          data.push([]);
        });

        tables[0].forEach(function (row, i) {
          for (t = 0; t < tables.length; t++) {
            data[t].push(tables[t][i]);
          }
        });

        tmpdata = [];
        (function traverseTable(D, t) {
          if (D.length === 0) {
            tmpdata.push(t.slice(0));
          } else {
            for (let i = 0; i < D[0].length; i++) {
              t.push(D[0][i]);
              traverseTable(D.slice(1), t);
              t.splice(-1, 1);
            }
          }
        })(data, []);

        data = [];
        tmpdata.forEach(function (row, i) {
          if (
            whereClauses.every(function (orWhereClauses) {
              return orWhereClauses.some(function (whereClause) {
                return whereClause(row);
              });
            })
          ) {
            data.push(row);
          }
        });
      } else if (tables.length === 1) {
        tables[0].forEach(function (row, i) {
          if (
            whereClauses.every(function (orWhereClauses) {
              return orWhereClauses.some(function (whereClause) {
                return whereClause(row);
              });
            })
          ) {
            data.push(row);
          }
        });
      } else {
        data = [];
      }

      // Group

      if (group.length > 0) {
        let T = {};

        data.forEach(function (row) {
          let t = T;
          group.forEach(function (groupCallback) {
            let k = groupCallback(row);
            t[k] = t[k] || {};
            t = t[k];
          });
          t._data = t._data || [];
          t._data.push(row);
        });

        (function traverse(node, R) {
          if (node._data != null) {
            node._data.forEach(function (e) {
              R.push(e);
            });
          } else {
            for (let k in node) {
              k = /\d+/.test(k) ? Number(k) : k;
              let row = [k, []];
              traverse(node[k], row[1]);
              R.push(row);
            }
          }
        })(T, gdata);

        gdata.forEach(function (grow) {
          if (
            havingClauses.every(function (orHavingClauses) {
              return orHavingClauses.some(function (havingClause) {
                return havingClause(grow);
              });
            })
          ) {
            tmpdata.push(grow);
          }
        });
        data = tmpdata;
      }

      order.forEach(function (orderCallback) {
        data = data.sort(orderCallback);
      });

      return data.map(selector || selectorAll);
    };

    return self;
  };

  function shuffleArray(array) {
    // Shuffle array
    const shuffled = array.sort(() => 0.5 - Math.random());
    return shuffled;
  }

  const fcpo = (function () {
    const WAIT_WEIGHTAGE = 8; // 8 means 8/10
    const RISK_MARGIN = 20;
    const MAX_DAILY_PERCENT_CHANGE = 0.1; // .1 = 10%
    const WAITS = Array(WAIT_WEIGHTAGE).fill("WAIT");
    const ACTIONS = shuffleArray(["BUY", "SELL", ...WAITS]);

    function getArrayRandomItem(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    // const ACTION = getArrayRandomItem(ACTIONS);
    const ACTION = ACTIONS[0];

    // get months D from bursa page
    function getMonthsD() {
      const trs = $("tbody tr.odd");
      let monthsD = {};
      d.group("getMonthsD");
      for (let index = 0; index <= MAX_MONTH_INDEX; index++) {
        d.log(`index = ${index}`);
        const tr = trs.eq(index);
        const tds = tr.find("td");
        const monthValues = {};
        let monthD = {};
        let month;
        d.group("monthD");
        for (const [key, value] of Object.entries(TR_INDICES)) {
          const td = tds[key];
          const $td = $(td);
          const columnValue = $td.text();
          d.log(`${value} = ${columnValue}`);
          if (key != TR_MONTH_INDEX) {
            monthValues[value] = Number(columnValue.replace(",", ""));
          } else {
            month = columnValue;
          }
        }
        if ((monthValues.VOLUME || 0) > 0) {
          monthD[month] = { ...monthValues };
          d.table(monthD);
          d.groupEnd();
          monthsD = updateMonthsD(monthsD, monthD);
        }
      }
      d.groupEnd();
      d.group("monthsD");
      d.table(monthsD);
      d.groupEnd();
      return monthsD;
    }

    /*
      monthD looks like this
          "Feb 2022": {
              "LAST_DONE": 5920,
              "HIGH": 5920,
              "LOW": 5900,
              "VOLUME": 50,
              "SETTLEMENT": 5935,
              "RANGE": 20,
              "HIGH_CHANGE": -15,
              "LOW_CHANGE": -35
          },
      monthsD looks like this
          "Feb 2022": {....},
          "Mar 2022": {....},
          ....

      each month has 2 rows - a (T + 1) and a row without
      This function checks whether there is already an entry for the monthD and then updates it for max High, min Low
      */
    function updateMonthsD(monthsD, monthD) {
      for (let [month, priceInfo] of Object.entries(monthD)) {
        const _priceInfo = monthsD[month];
        if (_priceInfo != undefined) {
          const newHigh = Math.max(priceInfo.HIGH, _priceInfo.HIGH);
          const newLow = Math.min(priceInfo.LOW, _priceInfo.LOW);
          const newRange = Math.max(priceInfo.RANGE, _priceInfo.RANGE);
          const diff = { HIGH: newHigh, LOW: newLow, RANGE: newRange };
          priceInfo = { ...priceInfo, ...diff };
          monthD[month] = { ...priceInfo };
        }
        monthsD = { ...monthsD, ...monthD };
      }
      return monthsD;
    }

    const monthsD = getMonthsD();
    const fcpoToday = today();
    d.log(`today = ${fcpoToday}`);
    const todayD = {};
    todayD[fcpoToday] = { ...monthsD };
    d.group("todayD");
    d.table(todayD);
    d.groupEnd();
    d.group("today View - with max, min change");
    // view contains additional columns - RANGE (high - low), HIGH_CHANGE (high - settlement), LOW_CHANGE (low - settlement)
    const todayView = getMonthsView(monthsD);
    console.log(
      "%c   👀  ==>  👀   ",
      "background-color: green; color: yellow",
      { todayView }
    );
    const maxRangeD = getMax(todayView, "RANGE");
    const maxVolumeD = getMax(todayView, "VOLUME");
    d.table(todayView);
    d.groupEnd();
    const db = _gm_getValue(KEY, {});
    const newDb = Object.assign(db, todayD);
    const tableData = table(newDb);
    d.group("monthDaysView");
    const monthDaysView = getMonthDaysView(newDb);
    d.table(monthDaysView);
    d.groupEnd();

    deleteOldDates();

    GM_setValue(KEY, newDb);
    addToolTip(monthDaysView);

    function table(db) {
      d.group("table");
      const _rows = [];
      for (const [date, dateData] of Object.entries(db)) {
        for (const [month, monthData] of Object.entries(dateData)) {
          const _row = {
            DATE: date,
            MONTH: month
          };
          const row = Object.assign(_row, monthData);
          _rows.push(row);
        }
      }
      d.table(_rows);
      // add RANGE column
      const rows = _rows.map((row) => {
        row["RANGE"] = row.HIGH - row.LOW;
        return row;
      });
      d.groupEnd();
      return rows;
    }

    function getLimits(settlement) {
      const limitDown = (
        (1 - MAX_DAILY_PERCENT_CHANGE) * settlement +
        RISK_MARGIN
      ).toFixed();
      const limitUp = (
        (1 + MAX_DAILY_PERCENT_CHANGE) * settlement -
        RISK_MARGIN
      ).toFixed();
      return { limitDown, limitUp };
    }

    function addToolTip(mdv) {
      d.group("addToolTip");
      for (const [month, columns] of Object.entries(mdv)) {
        d.table(columns);
        d.log(`month: ${month}`);
        const trs = $(`tbody tr:contains(${month})`);
        d.log(`==> [tr.length = ${trs.length}]`);
        for (const tr of trs) {
          const $tr = $(tr);
          const max = columns.MAX;
          const min = columns.MIN;
          const range = columns[0]?.RANGE;
          const settlement = getTrColumnValue($tr, "SETTLEMENT");
          const low = getTrColumnValue($tr, "LOW");
          const high = getTrColumnValue($tr, "HIGH");
          let gapAdvice = "";
          if (low > settlement) {
            gapAdvice = "GAP UP!!";
          }
          if (high < settlement) {
            gapAdvice = "GAP DOWN!!";
          }
          gapAdvice = gapAdvice ? `${gapAdvice}<br>` : "";
          const { limitDown, limitUp } = getLimits(settlement);
          $tr.tooltip({
            content: `
${gapAdvice}
Max: ${max}, Min: ${min}<br>
Range: ${range} Action:${ACTION}<br>
Limits (risk ${RISK_MARGIN}): ${limitUp} - ${limitDown}`
          });
        }
      }
      d.groupEnd();
    }
    function getTrColumnValues(row) {
      const values = {};
      for (const column of Object.values(TR_INDICES)) {
        const value = getTrColumnValue(row, column);
        values[column] = value;
      }
      const settlement = values.SETTLEMENT;

      const { limitDown, limitUp } = getLimits(settlement);

      return {
        ...values,
        LIMIT_DOWN: Number(limitDown),
        LIMIT_UP: Number(limitUp)
      };
    }

    function getTrColumnValue(tr, label) {
      d.group("getTrIndexValue");
      const index = getTrTdIndexOf(label);
      const tds = tr.find("td");
      const td = tds[index];
      const $td = $(td);
      const columnValue = $td.text();
      d.log(`==> [columnValue = ${columnValue}]`);
      const value = Number(columnValue.replace(",", ""));
      d.groupEnd();
      return value;
    }

    function getTrTdIndexOf(label) {
      const object = TR_INDICES;
      return Object.keys(object).find((key) => object[key] === label);
    }

    function getDailyRange(datesMonthsD) {
      const monthsDaysView = {};
      for (const [date, monthsD] of Object.entries(datesMonthsD)) {
        const _date = new Date(date);
        const dayDifference = getDayDifference(_date);
        if (dayDifference < MAX_DAY_DIFFERENCE) {
          const dayData = {};
          for (const [month, columns] of Object.entries(monthsD)) {
            d.group(
              `getMonthDaysView ${month} ${date} dayDifference ${dayDifference}`
            );
            const monthD = monthsDaysView[month] || {};
            dayData[dayDifference] = { ...columns };
            monthsDaysView[month] = Object.assign(monthD, dayData);
            d.table(monthsDaysView[month]);
            d.groupEnd();
          }
        }
      }
      return monthsDaysView;
    }

    // get view of fcpo's day difference columns
    // eg July 2021     1 day ago - high, low, ......., 2 days ago - high, low ..., MAX:, MIN:
    function getMonthDaysView(datesMonthsD) {
      const monthsDaysView = getDailyRange(datesMonthsD);

      for (const [month, dayData] of Object.entries(monthsDaysView)) {
        let min = 99999;
        let max = 0;
        const lows = [];
        const highs = [];
        for (const [dayDifference, columns] of Object.entries(dayData)) {
          if (columns.LOW < min) {
            min = columns.LOW;
          }
          if (columns.HIGH > max) {
            max = columns.HIGH;
          }
          lows.push(columns.LOW);
          highs.push(columns.HIGH);
        }
        const _lows = filterNull(lows);
        const _highs = filterNull(highs);
        const _min = Math.min(..._lows);
        const _max = Math.max(..._highs);
        // if (_min != min) {
        //     alert(`_min ${_min} != min ${min}`);
        // }
        // if (_max != max) {
        //     alert(`_max ${_max} != max ${max}`);
        // }
        const minMaxD = { MAX: _max, MIN: _min };
        const monthD = monthsDaysView[month] || {};
        monthsDaysView[month] = Object.assign(monthD, minMaxD);
      }
      d.group("getMonthDaysView");
      d.table(monthsDaysView);
      d.groupEnd();
      return monthsDaysView;
    }

    function filterNull(arr) {
      const result = arr.filter(Number);
      return result;
    }

    function old_getMaxRange(view) {
      const months = Object.keys(view);
      const interestedMonths = months.slice(0, 10);

      let max = 0;
      let maxRangeMonth = false;
      for (const [month, value] of Object.entries(view)) {
        if (interestedMonths.includes(month)) {
          if (value.RANGE > max) {
            max = value.RANGE;
            maxRangeMonth = month;
          }
        }
      }
      const maxD = {};
      maxD[maxRangeMonth] = max;
      return maxD;
    }

    function getMax(view, column) {
      const months = Object.keys(view);
      const interestedMonths = months.slice(0, 10);

      let max = 0;
      let maxMonth = false;
      for (const [month, value] of Object.entries(view)) {
        if (interestedMonths.includes(month)) {
          if (value[column] > max) {
            max = value[column];
            maxMonth = month;
          }
        }
      }
      const maxD = {};
      maxD[maxMonth] = max;
      return maxD;
    }

    function getMaxRange(view) {
      const months = Object.keys(view);
      const interestedMonths = months.slice(2, 10);

      let max = 0;
      let maxRangeMonth = false;
      for (const [month, value] of Object.entries(view)) {
        if (interestedMonths.includes(month)) {
          if (value.RANGE > max) {
            max = value.RANGE;
            maxRangeMonth = month;
          }
        }
      }
      const maxD = {};
      maxD[maxRangeMonth] = max;
      return maxD;
    }

    function getDatesInDb(_db = newDb) {
      const dates = Object.keys(_db);
      return dates;
    }

    // gets single day's fcpo months extra columns - range, high_change, low_change
    function getMonthsView(singleDayMonthsData) {
      d.group("getMonthsView");
      const view = { ...singleDayMonthsData };
      for (const [key, value] of Object.entries(singleDayMonthsData)) {
        d.log(`key = ${key}`);
        const monthData = singleDayMonthsData[key];
        const highChange = monthData.HIGH - monthData.SETTLEMENT;
        const lowChange = monthData.LOW - monthData.SETTLEMENT;
        const settlement = monthData.SETTLEMENT;

        monthData["RANGE"] = monthData.HIGH - monthData.LOW;
        monthData["HIGH_CHANGE"] = highChange;
        monthData["LOW_CHANGE"] = lowChange;

        view[key] = { ...monthData };
      }
      d.groupEnd();
      return view;
    }

    function getNewDateAdded() {
      const dbDates = getDatesInDb(db);
      const newDbDates = getDatesInDb(newDb);
      const newDateAdded = arr.difference(newDbDates, dbDates);
      return newDateAdded;
    }

    function deleteOldDates() {
      const newDateAdded = getNewDateAdded();

      if (newDateAdded) {
        for (const [date, monthsD] of Object.entries(newDb)) {
          const _d = new Date(date);
          const dayDifference = getDayDifference(_d);
          if (dayDifference > MAX_DAYS_DATA) {
            delete newDb[date];
            notify(`deleted ${date}`);
          }
        }
      }
    }

    return {
      monthsD: monthsD,
      db: newDb,
      table,
      tableData,
      datesInDb: getDatesInDb,
      maxRangeD,
      maxVolumeD,
      monthDaysView,
      ACTION,
      ACTIONS,
      getTrColumnValues
    };
  })();

  function monitorFcpo() {
    const maxVolumeMonth = getMaxVolumeMonth();
    const row = $(`table tr.odd:contains(${maxVolumeMonth})`);
    const $e = row.find(".stock_change");
    const values = fcpo.getTrColumnValues(row);
    console.log(
      `%c   👀  ==>  👀   `,
      "background-color: green; color: yellow",
      { values }
    );
    const change = parseInt($e.text());
    const abs_change = Math.abs(change);
    d.log(`change = ${change}`);
    if (abs_change > CHANGE_THRESHOLD) {
      const decimalHours = getDecimalHours();
      if (
        (decimalHours > MORNING_START && decimalHours < MORNING_END) ||
        (decimalHours > NOON_START && decimalHours < NOON_END) ||
        (decimalHours > NIGHT_START && decimalHours < NIGHT_END)
      ) {
        const changeMessage = `FCPO ${maxVolumeMonth} change is ${change}.`;
        const message =
          values.LOW <= values.LIMIT_DOWN || values.HIGH >= values.LIMIT_UP
            ? `${changeMessage} \nHit Limit!`
            : changeMessage;
        notify(message);
      }
    }
  }

  function testNotification() {
    const title = "test";
    const text = 'HEY! Your task "' + title + '" is now overdue.';
    const notification = new Notification("To do list", { body: text });
  }

  function flashScreen() {
    const container = $(".container.my-5");
    container.css("background", "blue");
    setTimeout(() => {
      container.css("background", "initial");
    }, 1000);
  }

  function getMaxVolumeMonth() {
    const maxVolumeMonth = Object.keys(fcpo.maxVolumeD)[0];
    const maxVolumeD = fcpo.maxVolumeD;
    console.log(
      "%c   👀  ==>  👀   ",
      "background-color: green; color: yellow",
      { maxVolumeMonth },
      { maxVolumeD }
    );
    return maxVolumeMonth;
  }

  function highlightRow() {
    console.log(`%c==> [highlightRow]`, "color: yellow");
    const maxMonth = getMaxVolumeMonth();
    const row = $(`table tr.odd:contains(${maxMonth})`);
    row.css("border", "2px solid red");
  }

  function today() {
    const _td = _today;
    let dd = _td.getDate();

    let mm = _td.getMonth() + 1;
    const yyyy = _td.getFullYear();
    if (dd < 10) {
      dd = `0${dd}`;
    }

    if (mm < 10) {
      mm = `0${mm}`;
    }
    return `${yyyy}-${mm}-${dd}`;
  }

  function _gm_getValue(key, defaultValue) {
    const value = GM_getValue(key);
    if (value == undefined) {
      return defaultValue;
    }
    return value;
  }

  function saveFcpo() {
    d.group("dates in Database");
    const datesInDb = fcpo.datesInDb();
    d.table(datesInDb);
    d.group("max range month");
    d.table(fcpo.maxRangeD);
    d.groupEnd();
    d.groupEnd();
  }

  function addToolTipStyle() {
    $("head").append(
      "<link " +
        'href="https://code.jquery.com/ui/1.12.1/themes/smoothness/jquery-ui.css" ' +
        'rel="stylesheet" type="text/css">'
    );
  }

  function copyItemsToClipboard(items) {
    const WAIT_MILISECONDS_BETWEEN_COPY = 1000;

    const loop = setInterval(() => {
      if (items.length > 0) {
        const item = items.shift();
        // d.log('copying '.concat(item));
        GM_setClipboard(item);
      } else {
        clearInterval(loop);
      }
    }, WAIT_MILISECONDS_BETWEEN_COPY);
  }

  function addDataButtons() {
    const searchButton = $(".btn-primary");
    const inputCenter = $(".input-center");
    const copyDataButton = $(
      '<button id="copy-history-data">Copy history data</button>'
    );
    copyDataButton.click(() => {
      const data = { FCPO: { ...fcpo.db } };
      const dataJson = JSON.stringify(data);
      const tableData = fcpo.tableData;
      const tableDataJson = JSON.stringify(tableData);
      const items = [dataJson, tableDataJson];
      copyItemsToClipboard(items);
    });
    inputCenter.after(copyDataButton);
    inputCenter.after(timerElement);
    inputCenter.after(logMessagesElement);
    timer.register(timerElement);
  }

  function reload() {
    const decimalHours = getDecimalHours();
    const reload = decimalHours < NIGHT_END;
    d.log(`decimalHours = ${decimalHours}, reload = ${reload}`);
    d.log(`ACTIONS = ${fcpo.ACTIONS}`);
    if (reload) {
      let waitHours;
      if (
        (decimalHours > MORNING_START && decimalHours < MORNING_END) ||
        (decimalHours > NOON_START && decimalHours < NOON_END) ||
        (decimalHours > NIGHT_START && decimalHours < NIGHT_END)
      ) {
        d.log("In trading session");
        waitHours = 0.25;
      } else if (decimalHours <= MORNING_START) {
        d.log("before morning trade session");
        waitHours = MORNING_START - decimalHours;
      } else if (decimalHours <= NOON_START) {
        d.log("after morning trade session");
        waitHours = NOON_START - decimalHours;
      } else if (decimalHours <= NIGHT_START) {
        d.log("after morning trade session");
        waitHours = NIGHT_START - decimalHours;
      }
      const waitMiliseconds = waitHours * 60 * 60 * 1000;
      timer.setTimeOut(
        "reload",
        () => {
          location.reload();
          console.log(
            `%c==> [reload]`,
            "background-color: #0595DE; color: yellow; padding: 8px; border-radius: 4px;"
          );
        },
        waitMiliseconds
      );
    }
  }

  function addAction() {
    const b = $("#copy-history-data");
    const h1 = $(`<h1>${fcpo.ACTION}</h1>`);
    b.after(h1);
  }

  $(function () {
    function isWeekDay() {
      const day = new Date().getDay();
      return day > 0 && day < 6;
    }

    if (!isWeekDay()) {
      return;
    }
    askNotificationPermission();
    saveFcpo();
    highlightRow();
    monitorFcpo();
    addToolTipStyle();
    addDataButtons();
    addAction();

    reload();

    // do something on document ready
  }); // end ready
})(jQuery); //invoke nameless function and pass it the jQuery object

// version 1.1
// . save data
// . gets min, max over last 7 days
// . finds row with max range

// version 1.2
// . delete old data automatically

// version 1.3
// . added copyData button

// version 1.4
// . copyData - copy table too
// . added query() for sql

// version 1.41
// . commented out alert _min, _max
// version 1.43
// . added d.log to debug waitHours, made RANGE options in addToolTip

// version 1.6
// . added addAction

// version 1.61
// . added action in notification
// version 1.62
// . added max limit up, down
