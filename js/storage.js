/**
 * HCM Lite — Storage & Utility Layer
 * Manages LocalStorage persistence, safe JSON operations, data models,
 * and reliable local date, time, and currency utilities.
 */

const Storage = (() => {
  'use strict';

  // Primary LocalStorage Keys (as required by specifications)
  const KEYS = {
    COMPANY: 'hcm_company',
    USERS: 'hcm_users',
    ATTENDANCE: 'hcm_attendance',
    LEAVES: 'hcm_leaves',
    SESSION: 'hcm_session',
    ANNOUNCEMENTS: 'hcm_announcements'
  };

  // Default Company Profile & Policy Template
  const DEFAULT_COMPANY = {
    companyName: 'Acme Corporation',
    companyEmail: 'hr@acme.com',
    companyAddress: '45 Innovation Way, Suite 300, Karachi',
    companyPhone: '+92 21 34567890',
    officeStartTime: '09:00',
    gracePeriod: 15,
    dailyWorkHours: 8,
    workingDays: [1, 2, 3, 4, 5], // 0=Sun, 1=Mon, ..., 6=Sat (Mon-Fri)
    yearlyLeaveQuota: 20,
    leavePolicyDescription: 'Employees are entitled to 20 paid leave days annually. All applications must be submitted at least 24 hours prior to planned absence, except in emergency sick leave situations.',
    officeLatitude: null,
    officeLongitude: null,
    officeRadius: 200
  };

  /**
   * Safely read and parse data from LocalStorage.
   * @param {string} key
   * @param {any} defaultValue
   * @returns {any}
   */
  function get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null || item === undefined) {
        return defaultValue;
      }
      return JSON.parse(item);
    } catch (err) {
      console.warn(`[Storage] Failed to read or parse key "${key}":`, err);
      return defaultValue;
    }
  }

  /**
   * Safely serialize and write data to LocalStorage.
   * @param {string} key
   * @param {any} value
   * @returns {boolean}
   */
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`[Storage] Failed to write key "${key}":`, err);
      return false;
    }
  }

  /**
   * Safely remove a key from LocalStorage.
   * @param {string} key
   */
  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`[Storage] Failed to remove key "${key}":`, err);
    }
  }

  /**
   * Generate an ID with a specified prefix.
   * @param {string} prefix
   * @returns {string} e.g. "EMP-1042" or "LV-8921"
   */
  function generateId(prefix = 'id') {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${prefix.toUpperCase()}-${randomSuffix}`;
  }

  /**
   * Format a Date object into local "YYYY-MM-DD" string.
   * Avoids UTC timezone shifts.
   * @param {Date} date
   * @returns {string}
   */
  function formatLocalDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Returns today's local date as "YYYY-MM-DD".
   * @returns {string}
   */
  function getTodayLocalDate() {
    return formatLocalDate(new Date());
  }

  /**
   * Parse a "YYYY-MM-DD" date string into a Date object at local 00:00:00.
   * @param {string} dateStr
   * @returns {Date|null}
   */
  function parseLocalDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return new Date(y, m, d, 0, 0, 0, 0);
  }

  /**
   * Format a Date or current time into "HH:MM" (24-hour local time).
   * @param {Date} [date]
   * @returns {string}
   */
  function formatLocalTime(date = new Date()) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Convert "HH:MM" time string to minutes from midnight.
   * @param {string} timeStr
   * @returns {number}
   */
  function timeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    // Destructuring ki jagah simple variable use karo
    var timeParts = timeStr.split(':');
    var h = parseInt(timeParts[0], 10);
    var m = parseInt(timeParts[1], 10);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  }

  /**
   * Convert minutes from midnight to "HH:MM" time string.
   * @param {number} totalMinutes
   * @returns {string}
   */
  function minutesToTime(totalMinutes) {
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = Math.floor(totalMinutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /**
   * Format total work minutes into readable "Xh Ym" format.
   * @param {number} totalMinutes
   * @returns {string}
   */
  function formatHoursMinutes(totalMinutes) {
    if (isNaN(totalMinutes) || totalMinutes <= 0) return '0h 00m';
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.floor(totalMinutes % 60);
    return `${hours}h ${String(mins).padStart(2, '00')}m`;
  }

  /**
   * Format a number as currency (PKR 123,456.00).
   * @param {number} amount
   * @returns {string}
   */
  function formatCurrency(amount) {
    const num = isNaN(amount) ? 0 : Number(amount);
    return `PKR ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Count configured working days between two dates (inclusive).
   * Skips weekends/non-working days according to configured working weekdays.
   * @param {string} startDateStr - "YYYY-MM-DD"
   * @param {string} endDateStr - "YYYY-MM-DD"
   * @param {number[]} [workingDays] - Array of weekday numbers [0=Sun, 1=Mon, ..., 6=Sat]
   * @returns {number}
   */
  function countWorkingDays(startDateStr, endDateStr, workingDays = [1, 2, 3, 4, 5]) {
    const start = parseLocalDate(startDateStr);
    const end = parseLocalDate(endDateStr);
    if (!start || !end || start > end) return 0;

    let count = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (workingDays.includes(dayOfWeek)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * Count total working days in a given calendar month.
   * Optionally limit to a max day of the month (e.g. today).
   * @param {number} year
   * @param {number} monthIndex - 0 for Jan, 11 for Dec
   * @param {number[]} [workingDays]
   * @param {number|null} [maxDay]
   * @returns {number}
   */
  function getWorkingDaysInMonth(year, monthIndex, workingDays = [1, 2, 3, 4, 5], maxDay = null) {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const limit = maxDay ? Math.min(maxDay, daysInMonth) : daysInMonth;
    let count = 0;

    for (let day = 1; day <= limit; day++) {
      const date = new Date(year, monthIndex, day);
      if (workingDays.includes(date.getDay())) {
        count++;
      }
    }

    return count;
  }

  /**
   * Check if two date ranges overlap.
   * Ranges are considered overlapping if (start1 <= end2) && (end1 >= start2).
   * @param {string} start1Str
   * @param {string} end1Str
   * @param {string} start2Str
   * @param {string} end2Str
   * @returns {boolean}
   */
  function isDateOverlap(start1Str, end1Str, start2Str, end2Str) {
    const s1 = parseLocalDate(start1Str);
    const e1 = parseLocalDate(end1Str);
    const s2 = parseLocalDate(start2Str);
    const e2 = parseLocalDate(end2Str);
    if (!s1 || !e1 || !s2 || !e2) return false;
    return s1 <= e2 && e1 >= s2;
  }

  /**
   * Convert a numeric salary value to words (for official payslip).
   * @param {number} amount
   * @returns {string}
   */
  function amountToWords(amount) {
    const n = Math.floor(Math.abs(Number(amount) || 0));
    if (n === 0) return 'Zero Rupees Only';

    const a = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function inWords(num) {
      if (num < 20) return a[num];
      if (num < 100) return b[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + a[num % 10] : '');
      if (num < 1000) return a[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' and ' + inWords(num % 100) : '');
      if (num < 100000) return inWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + inWords(num % 1000) : '');
      if (num < 10000000) return inWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 !== 0 ? ' ' + inWords(num % 100000) : '');
      return inWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 !== 0 ? ' ' + inWords(num % 10000000) : '');
    }

    return `${inWords(n)} Rupees Only`;
  }

  /**
   * Get the company settings or provide the default template.
   * @returns {Object}
   */
  function getCompanySettings() {
    return get(KEYS.COMPANY, DEFAULT_COMPANY);
  }

  /**
   * Save company settings.
   * Spread ki jagah Object.assign use karo - same kaam karta hai lekin ziada clear hai
   * @param {Object} settings
   * @returns {boolean}
   */
  function saveCompanySettings(settings) {
    const current = getCompanySettings();
    const updated = Object.assign({}, current, settings);
    return set(KEYS.COMPANY, updated);
  }

  return {
    KEYS,
    DEFAULT_COMPANY,
    get,
    set,
    remove,
    generateId,
    formatLocalDate,
    getTodayLocalDate,
    parseLocalDate,
    formatLocalTime,
    timeToMinutes,
    minutesToTime,
    formatHoursMinutes,
    formatCurrency,
    countWorkingDays,
    getWorkingDaysInMonth,
    isDateOverlap,
    amountToWords,
    getCompanySettings,
    saveCompanySettings
  };
})();
