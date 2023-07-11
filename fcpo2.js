///ddtool/ ==UserScript==
// @name         Bursa enhancements
// @namespace    https://wpcomhappy.wordpress.com/
// @icon         https://raw.githubusercontent.com/soufianesakhi/feedly-filtering-and-sorting/master/web-ext/icons/128.png
// @version      2
// @description  Tool for enhancing Bursa
// @author       Siew "@xizun"
// @match        https://www.bursamalaysia.com/market_information/*
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_notification
// @require      http://code.jquery.com/jquery-3.4.1.min.js
// @require      http://code.jquery.com/ui/1.12.1/jquery-ui.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// ==/UserScript==

(function ($) {
  //function to create private scope with $ parameter
  // FcpoPlus.js
  const options = {
    DEBUG: true
  };
  const MAX_DAYS_DATA = 31;
  (WAIT_MILISECONDS = 600000),
    (CHANGE_THRESHOLD = 100),
    (NOTIFICATION_TITLE = "FCPO Alert"),
    (MORNING_START = 10.75),
    (MORNING_END = 12.75),
    (NOON_START = 14.75),
    (NOON_END = 18.26),
    (NIGHT_START = 21.25),
    (NIGHT_END = 23.75);
  const CSS_CLASS_HIGHLIGHT = "highlight";
  const KEY = "FCPO2";
  const HIGHLIGHT_INDEX = 0;
  const WAIT_WEIGHTAGE = 8; // 8 means 8/10
  const RISK_MARGIN = 20;
  const MAX_DAILY_PERCENT_CHANGE = 0.1; // .1 = 10%
  const WAITS = Array(WAIT_WEIGHTAGE).fill("WAIT");
  const ACTIONS = shuffleArray(["BUY", "SELL", ...WAITS]);

  const _today = truncateDate(new Date()); // new Date(new Date().getFullYear(),new Date().getMonth() , new Date().getDate());
  const logMessagesElement = $('<h5 id="log-messages">log messages</h5>');
  const timerElement = $('<h5 id="timer">timer</h5>');

  const TR_INDICES = {
    2: "NAME",
    3: "MONTH",
    7: "LAST",
    8: "CHANGE",
    13: "SETTLEMENT",
    9: "HIGH",
    10: "LOW",
    11: "VOLUME"
  };

  const TR_COLUMN_INDICES = flipObject(TR_INDICES);

  $.fn.multiline = function (text) {
    this.text(text);
    this.html(this.html().replace(/\n/g, "<br/>"));
    return this;
  };

  // for debugging
  const d = (function () {
    const debug = options.DEBUG;
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
      log,
      group,
      groupEnd,
      table,
      debug
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

  function notify(text) {
    d.log("notify+ " + text);
    const title = NOTIFICATION_TITLE;
    GM_notification({ title, text });
  }

  function getDecimalHours() {
    const d = new Date();
    const h = d.getHours();
    const m = d.getMinutes();

    const decimalHours = h + m / 60;
    return decimalHours;
  }

  function truncateDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
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

  function shuffleArray(array) {
    // Shuffle array
    const shuffled = array.sort(() => 0.5 - Math.random());
    return shuffled;
  }

  function getLimits(settlement) {
    const down = (
      (1 - MAX_DAILY_PERCENT_CHANGE) * settlement +
      RISK_MARGIN
    ).toFixed();
    const up = (
      (1 + MAX_DAILY_PERCENT_CHANGE) * settlement -
      RISK_MARGIN
    ).toFixed();
    return { down, up };
  }

  function monitorFcpo(row, db) {
    d.log("monitorFcpo+");
    const { month, high, low, settlement } = getColumnValues(row, [
      "MONTH",
      "CHANGE",
      "HIGH",
      "LOW",
      "SETTLEMENT"
    ]);
    const change = getChange(high, low, settlement);
    if (change > CHANGE_THRESHOLD) {
      d.log(`FCPO ${month} max change is ${change} > ${CHANGE_THRESHOLD}`);
      const limit = getLimits(settlement);
      const decimalHours = getDecimalHours();
      if (
        (decimalHours > MORNING_START && decimalHours < MORNING_END) ||
        (decimalHours > NOON_START && decimalHours < NOON_END) ||
        (decimalHours > NIGHT_START && decimalHours < NIGHT_END)
      ) {
        const changeMessage = `FCPO ${month} max change is ${change}.`;
        const message =
          low <= limit.down || high >= limit.up
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

  function highlightElement(elem, color = "yellow") {
    elem.style.backgroundColor = color;
  }

  function flipObject(obj) {
    let flipped = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        flipped[obj[key]] = key;
      }
    }
    return flipped;
  }

  function flashScreen() {
    const container = $(".container.my-5");
    container.css("background", "blue");
    setTimeout(() => {
      container.css("background", "initial");
    }, 1000);
  }

  function isWeekDay() {
    const day = new Date().getDay();
    return day > 0 && day < 6;
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

  function addToolTipStyle() {
    d.log("addToolTipStyle+");
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

  function addDataButtons(db) {
    d.log("addDataButtons+");
    const searchButton = $(".btn-primary");
    const inputCenter = $(".input-center");
    const copyDataButton = $(
      '<button id="copy-history-data">Copy history data</button>'
    );
    copyDataButton.click(() => {
      const data = { FCPO: { ...db } };
      const dataJson = JSON.stringify(data);
      const items = [dataJson];
      copyItemsToClipboard(items);
    });
    inputCenter.after(copyDataButton);
    inputCenter.after(timerElement);
    inputCenter.after(logMessagesElement);
  }

  function reload() {
    d.log("reload+");
    timer.register(timerElement);
    const decimalHours = getDecimalHours();
    const reload = decimalHours < NIGHT_END;
    d.log(`decimalHours = ${decimalHours}, reload = ${reload}`);
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

  function addAction(action) {
    d.log("addAction+");
    const b = $("#copy-history-data");
    const h1 = $(`<h1>${action}</h1>`);
    b.after(h1);
  }

  function elementAddClass(elem, className) {
    elem.classList.add(className);
  }

  function parseContent(content) {
    // Check if the content is numeric or NaN
    if (
      /^-?\d[\d,]*(\.\d+)?$/.test(content) ||
      content.toLowerCase() === "nan"
    ) {
      // Remove commas, convert the content to a number, and process NaN as 0
      return parseFloat(content.replace(/,/g, "")) || 0;
    }

    return content;
  }

  function getCellValue(row, columnName) {
    const columnIndex = TR_COLUMN_INDICES[columnName];
    const cell = row.querySelector(`td:nth-child(${columnIndex})`);
    const content = cell.textContent.trim();

    return parseContent(content);
  }

  // pre-requisite cells in row has relevant css class
  function getValueOfElementByCssClass(row, cssClass) {
    d.log("getValueOfElementByCssClass+ " + cssClass.toLowerCase());
    const cell = row.querySelector(`.${cssClass.toLowerCase()}`);
    const content = cell.textContent.trim();

    return parseContent(content);
  }
  function getCell(row, columnName) {
    const columnIndex = TR_COLUMN_INDICES[columnName];
    const cell = row.querySelector(`td:nth-child(${columnIndex})`);
    return cell;
  }

  // pre-requisite cells in row has relevant css class
  function getColumnValues(row, keys) {
    const result = {};

    keys.forEach((key) => {
      result[key.toLowerCase()] = getValueOfElementByCssClass(row, key);
    });

    return result;
  }

  function getColumnCells(row, keys) {
    d.log("getColumnCells+");
    const result = {};

    keys.forEach((key) => {
      result[key.toLowerCase()] = getCell(row, key);
    });

    return result;
  }

  function getTodayJson(rowClasses) {
    const jsonData = [];

    for (const cssClass of rowClasses) {
      // find element with cssClass
      const row = document.querySelector(`.${cssClass}`);
      const { name, month, settlement, change, high, low, volume } =
        getColumnValues(row, [
          "NAME",
          "MONTH",
          "SETTLEMENT",
          "CHANGE",
          "HIGH",
          "LOW",
          "VOLUME"
        ]);

      if (month && volume !== "-") {
        jsonData.push({
          name,
          month,
          settlement,
          change,
          high,
          low,
          volume
        });
      }
    }
    const date = _today;
    return { [date]: jsonData };
  }

  function generateClassName(name, month = "") {
    const combined = name + month;
    const validClassName = combined.replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
    d.log(
      `generateClassName: name:${name} month:${month} class:${validClassName}`
    );
    return validClassName;
  }

  function createObjectFromArrays(keys, cells) {
    const result = {};

    if (keys.length === cells.length) {
      for (let i = 0; i < keys.length; i++) {
        result[keys[i]] = cells[i];
      }
    } else {
      console.error("Keys and cells arrays should have the same length.");
    }

    return result;
  }

  function addClassNamesToCells(row, keys) {
    d.log("addClassNamesToCells+");
    const cells = getColumnCells(row, keys);

    // key, values from cells
    for (const [key, cell] of Object.entries(cells)) {
      const className = generateClassName(key);
      elementAddClass(cell, className);
    }
  }

  function addClassNamesToRows(rows) {
    d.log("addClassNamesToRows+");
    const classes = [];
    for (const row of rows) {
      const name = getCellValue(row, "NAME");
      const month = getCellValue(row, "MONTH");
      const className = generateClassName(name, month);

      elementAddClass(row, className);
      d.log("addClassNamesToRows - " + className);
      addClassNamesToCells(row, [
        "NAME",
        "MONTH",
        "SETTLEMENT",
        "CHANGE",
        "HIGH",
        "LOW",
        "VOLUME"
      ]);
      if (!name.includes("T+1")) {
        classes.push(className);
      }
    }
    return classes;
  }

  function truncateDB() {
    const db = _gm_getValue(KEY, {});
    const dayMiliseconds = 1000 * 60 * 60 * 24;
    const keys = Object.keys(db);
    for (const key of keys) {
      // key has format yyyy-mm-dd
      // delete keys which are x days old
      const diff = new Date(_today) - truncateDate(new Date(key));
      const days = diff / dayMiliseconds;
      if (days > MAX_DAYS_DATA) {
        delete db[key];
      }
    }
    return db;
  }

  function saveFcpo(rowClasses) {
    d.log("saveFcpo+");
    const todayJson = getTodayJson(rowClasses);
    const truncatedDB = truncateDB();
    const updatedDB = { ...truncatedDB, ...todayJson };
    GM_setValue(KEY, updatedDB);
    return { db: updatedDB, todayJson };
  }

  function getTableAndRows() {
    d.log("getTableAndRows+");
    const table = document.querySelector("#DataTables_Table_0 > tbody");
    const rows = table.querySelectorAll("tr");
    return { table, rows };
  }

  function highlightRow(todayJson, highlightIndex = HIGHLIGHT_INDEX) {
    d.log("highlightRow+");
    const rows = todayJson[_today];
    console.log(
      `%c👀  ==> [highlightRow] 👀`,
      "background-color: #0595DE; color: yellow; padding: 8px; border-radius: 4px;",
      { rows }
    );
    if (rows.length > 0) {
      const monthVolumes = [];
      for (const row of rows) {
        const { name, month, volume } = row;
        const key = generateClassName(name, month);
        monthVolumes.push({ key, volume });
      }
      // sort by volume descending
      monthVolumes.sort((a, b) => b.volume - a.volume);
      const topVolumes = monthVolumes.slice(0, highlightIndex + 1);
      const indexItem = topVolumes[highlightIndex];
      const cssClass = indexItem.key;
      const row = document.querySelector(`.${cssClass}`);
      elementAddClass(row, CSS_CLASS_HIGHLIGHT);
      highlightElement(row);
      return row;
    }
  }

  function generateMinMaxByMonth(db) {
    d.group("generateMinMaxByMonth+ ");
    const result = {};
    d.log("generateMinMaxByMonth db:" + JSON.stringify(db));

    // keys, values in db
    for (const [date, monthsRows] of Object.entries(db)) {
      console.log(
        `%c👀  ==> [generateMinMax] 👀`,
        "background-color: #0595DE; color: yellow; padding: 8px; border-radius: 4px;",
        { date, monthsRows }
      );
      for (const monthRow of monthsRows) {
        const { month, low, high } = monthRow;
        console.log(
          `%c👀  ==> [generateMinMax] 👀`,
          "background-color: #0595DE; color: yellow; padding: 8px; border-radius: 4px;",
          { month, low, high }
        );
        if (result[month]) {
          result[month].min = Math.min(result[month].min, low);
          result[month].max = Math.max(result[month].max, high);
        } else {
          result[month] = { month, min: low, max: high };
        }
      }
    }
    d.log("generateMinMaxByMonth- " + JSON.stringify(result));
    d.groupEnd();
    return result;
  }

  function getAction(change) {
    const abs_change = Math.abs(change);
    if (abs_change >= CHANGE_THRESHOLD) {
      return change > 0 ? "SELL" : "BUY";
    }
    return `CHANGE ${change}, Sit Tight`;
  }

  function getChange(high, low, settlement) {
    const change = Math.max(
      Math.abs(high - settlement),
      Math.abs(low - settlement)
    );
    return change;
  }

  function addToolTip(todayJson, db) {
    d.group("addToolTip");
    const minMaxByMonth = generateMinMaxByMonth(db);
    const rows = todayJson[_today];
    for (const row of rows) {
      const { name, month, settlement, high, low, volume } = row;
      const cssClass = generateClassName(name, month);
      const rowElement = document.querySelector(`.${cssClass}`);
      const $rowElement = $(rowElement);
      const { max, min } = minMaxByMonth[month];
      const range = max - min;
      // max of abs (high - settlement), abs (low - settlement)
      const change = getChange(high, low, settlement);
      const action = getAction(change);
      let gapAdvice = "";
      if (low > settlement) {
        gapAdvice = "GAP UP!!";
      }
      if (high < settlement) {
        gapAdvice = "GAP DOWN!!";
      }
      gapAdvice = gapAdvice ? `${gapAdvice}<br>` : "";
      const { down, up } = getLimits(settlement);
      $rowElement.tooltip({
        content: `
${gapAdvice}
${MAX_DAYS_DATA} days<br>
Max: ${max}, Min: ${min}<br>
Range: ${range} Action:${action}<br>
Limits (risk ${RISK_MARGIN}): ${up} - ${down}`
      });
    }
    d.groupEnd();
  }

  d.log("waiting for document ready");
  $(function () {
    d.log("document ready");

    if (!isWeekDay()) {
      notify("Not a weekday, exiting");
      return;
    }
    askNotificationPermission();
    const { table, rows } = getTableAndRows();
    const rowClasses = addClassNamesToRows(rows);
    const { db, todayJson } = saveFcpo(rowClasses);
    const row = highlightRow(todayJson);
    if (row) {
      monitorFcpo(row, db);
      addToolTipStyle();
      addToolTip(todayJson, db);
    }

    addDataButtons(db);
    reload();
    // do something on document ready
  }); // end ready
})(jQuery); //invoke nameless function and pass it the jQuery object
