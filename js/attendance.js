/**
 * HCM Lite — Attendance Business Logic Layer
 * Enforces punch rules, grace period tolerances, half-day hour thresholds,
 * and monthly work statistics for employees and company-wide dashboards.
 */

const Attendance = (() => {
  'use strict';

  /**
   * Record check-in for an employee on the current local day.
   * Check-in matlab employee ka aana record karna - late hai ya time par.
   * Grace period se check karte hain ke kitna delay allowed hai.
   * @param {string} employeeId
   * @returns {{success: boolean, error?: string, record?: Object}}
   */
  function checkIn(employeeId) {
    if (!employeeId) return { success: false, error: 'Employee ID required.' };

    const todayStr = Storage.getTodayLocalDate();
    const attendanceList = Storage.get(Storage.KEYS.ATTENDANCE, []);

    // 1. Enforce single check-in per employee per day
    var existing = null;
    for (var i = 0; i < attendanceList.length; i++) {
      if (attendanceList[i].employeeId === employeeId && attendanceList[i].date === todayStr) {
        existing = attendanceList[i];
        break;
      }
    }
    if (existing) {
      return { success: false, error: 'You have already checked in today at ' + existing.checkIn + '.' };
    }

    const company = Storage.getCompanySettings();
    const officeStart = company.officeStartTime || '09:00';

    // Grace period zero-value fix: agar 0 hai to 0 rehne do, sirf NaN ya negative par default use karo
    var graceMin = parseInt(company.gracePeriod, 10);
    if (isNaN(graceMin) || graceMin < 0) {
      graceMin = 15;
    }

    const currentTimeStr = Storage.formatLocalTime();
    const currentMins = Storage.timeToMinutes(currentTimeStr);
    const lateThresholdMins = Storage.timeToMinutes(officeStart) + graceMin;

    // Late if check-in is strictly after office start + grace period
    const isLate = currentMins > lateThresholdMins;
    const status = isLate ? 'late' : 'present';

    const newRecord = {
      id: Storage.generateId('att'),
      employeeId,
      date: todayStr,
      checkIn: currentTimeStr,
      checkOut: null,
      workMinutes: 0,
      status, // 'present' | 'late' | 'half-day'
      isLate
    };

    attendanceList.push(newRecord);
    Storage.set(Storage.KEYS.ATTENDANCE, attendanceList);

    return { success: true, record: newRecord };
  }

  /**
   * Record check-out for an employee on the current day.
   * @param {string} employeeId
   * @returns {{success: boolean, error?: string, record?: Object}}
   */
  function checkOut(employeeId) {
    if (!employeeId) return { success: false, error: 'Employee ID required.' };

    const todayStr = Storage.getTodayLocalDate();
    const attendanceList = Storage.get(Storage.KEYS.ATTENDANCE, []);

    var index = -1;
    for (var i = 0; i < attendanceList.length; i++) {
      if (attendanceList[i].employeeId === employeeId && attendanceList[i].date === todayStr) {
        index = i;
        break;
      }
    }

    if (index === -1) {
      return { success: false, error: 'You must check in first before checking out.' };
    }

    const record = attendanceList[index];
    if (record.checkOut) {
      return { success: false, error: 'You have already checked out today at ' + record.checkOut + '.' };
    }

    const currentTimeStr = Storage.formatLocalTime();
    const checkInMins = Storage.timeToMinutes(record.checkIn);
    const checkOutMins = Storage.timeToMinutes(currentTimeStr);

    if (checkOutMins <= checkInMins) {
      return { success: false, error: 'Check-out time must be later than check-in time.' };
    }

    const duration = checkOutMins - checkInMins;

    // Rule: Less than 5 hours (300 minutes) triggers half-day status
    let finalStatus = record.status;
    if (duration < 300) {
      finalStatus = 'half-day';
    }

    record.checkOut = currentTimeStr;
    record.workMinutes = duration;
    record.status = finalStatus;

    attendanceList[index] = record;
    Storage.set(Storage.KEYS.ATTENDANCE, attendanceList);

    return { success: true, record };
  }

  /**
   * Retrieve today's attendance record for an employee.
   * @param {string} employeeId
   * @returns {Object|null}
   */
  function getTodayAttendance(employeeId) {
    const todayStr = Storage.getTodayLocalDate();
    const attendanceList = Storage.get(Storage.KEYS.ATTENDANCE, []);
    for (var i = 0; i < attendanceList.length; i++) {
      if (attendanceList[i].employeeId === employeeId && attendanceList[i].date === todayStr) {
        return attendanceList[i];
      }
    }
    return null;
  }

  /**
   * Retrieve historical attendance logs for a specific employee.
   * @param {string} employeeId
   * @returns {Object[]} sorted newest first
   */
  function getEmployeeAttendanceHistory(employeeId) {
    const attendanceList = Storage.get(Storage.KEYS.ATTENDANCE, []);
    var filtered = [];
    for (var i = 0; i < attendanceList.length; i++) {
      if (attendanceList[i].employeeId === employeeId) {
        filtered.push(attendanceList[i]);
      }
    }
    filtered.sort(function(a, b) { return b.date.localeCompare(a.date); });
    return filtered;
  }

  /**
   * Retrieve all attendance records logged today company-wide.
   * @returns {Object[]}
   */
  function getCompanyAttendanceToday() {
    const todayStr = Storage.getTodayLocalDate();
    const attendanceList = Storage.get(Storage.KEYS.ATTENDANCE, []);
    var result = [];
    for (var i = 0; i < attendanceList.length; i++) {
      if (attendanceList[i].date === todayStr) {
        result.push(attendanceList[i]);
      }
    }
    return result;
  }

  /**
   * Calculate summary statistics for weekly attendance chart (Mon-Fri).
   * @returns {Array<{dayName: string, dateStr: string, present: number, late: number, absent: number}>}
   */
  function getWeeklyAttendanceSummary() {
    const now = new Date();
    // Find Monday of the current week
    const currentDay = now.getDay();
    // Diff to Monday: (currentDay === 0 ? -6 : 1 - currentDay)
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const summary = [];
    const attendanceList = Storage.get(Storage.KEYS.ATTENDANCE, []);
    const allEmp = Employees.getAllEmployees();
    var totalStaffCount = 0;
    for (var ei = 0; ei < allEmp.length; ei++) {
      if (allEmp[ei].active !== false) totalStaffCount++;
    }

    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = Storage.formatLocalDate(d);

      var dayRecords = [];
      for (var j = 0; j < attendanceList.length; j++) {
        if (attendanceList[j].date === dateStr) {
          dayRecords.push(attendanceList[j]);
        }
      }
      const presentCount = dayRecords.length;
      var lateCount = 0;
      for (var k = 0; k < dayRecords.length; k++) {
        if (dayRecords[k].isLate) lateCount++;
      }
      const absentCount = Math.max(0, totalStaffCount - presentCount);

      summary.push({
        dayName: weekDays[i],
        dateStr,
        present: presentCount,
        late: lateCount,
        absent: absentCount
      });
    }

    return summary;
  }

  /**
   * Calculate monthly attendance figures for an employee used in payslips and personal KPI.
   * Excludes dates before the employee was hired, future dates, and approved leaves.
   * @param {string} employeeId
   * @param {number} year
   * @param {number} monthIndex - 0 to 11
   * @returns {Object}
   */
  function getMonthlyAttendanceStats(employeeId, year, monthIndex) {
    const employee = Employees.getEmployeeById(employeeId);
    if (!employee) {
      return { workingDays: 0, presentDays: 0, absentDays: 0, halfDays: 0, lateDays: 0, leaveDays: 0 };
    }

    const company = Storage.getCompanySettings();
    const workingDaysConfig = company.workingDays || [1, 2, 3, 4, 5];

    const now = new Date();
    const isCurrentMonth = (now.getFullYear() === year && now.getMonth() === monthIndex);
    const maxDay = isCurrentMonth ? now.getDate() : new Date(year, monthIndex + 1, 0).getDate();

    // Total working days in month
    const totalWorkingDaysInMonth = Storage.getWorkingDaysInMonth(year, monthIndex, workingDaysConfig);

    // Working days elapsed up to maxDay (only count from employee creation date onwards)
    const empCreatedDate = Storage.parseLocalDate(employee.createdAt ? employee.createdAt.slice(0, 10) : '2020-01-01');
    let elapsedWorkingDays = 0;

    for (let day = 1; day <= maxDay; day++) {
      const dayDate = new Date(year, monthIndex, day);
      if (workingDaysConfig.includes(dayDate.getDay())) {
        if (!empCreatedDate || dayDate >= empCreatedDate) {
          elapsedWorkingDays++;
        }
      }
    }

    // Get attendance records in this month
    const monthPrefix = year + '-' + String(monthIndex + 1).padStart(2, '0');
    const allAttendance = Storage.get(Storage.KEYS.ATTENDANCE, []);
    var empRecords = [];
    for (var i = 0; i < allAttendance.length; i++) {
      if (allAttendance[i].employeeId === employeeId && allAttendance[i].date.startsWith(monthPrefix)) {
        empRecords.push(allAttendance[i]);
      }
    }

    const presentDays = empRecords.length;
    var halfDays = 0;
    var lateDays = 0;
    for (var j = 0; j < empRecords.length; j++) {
      if (empRecords[j].status === 'half-day') halfDays++;
      if (empRecords[j].isLate) lateDays++;
    }

    // Get approved leave days in this month
    const approvedLeaves = Leave ? Leave.getApprovedLeaveDaysInMonth(employeeId, year, monthIndex) : 0;

    // Absent = Elapsed working days - present days - approved leaves
    const absentDays = Math.max(0, elapsedWorkingDays - presentDays - approvedLeaves);

    return {
      workingDays: totalWorkingDaysInMonth,
      elapsedWorkingDays,
      presentDays,
      absentDays,
      halfDays,
      lateDays,
      leaveDays: approvedLeaves
    };
  }

  return {
    checkIn,
    checkOut,
    getTodayAttendance,
    getEmployeeAttendanceHistory,
    getCompanyAttendanceToday,
    getWeeklyAttendanceSummary,
    getMonthlyAttendanceStats
  };
})();
