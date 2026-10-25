/**
 * HCM Lite — Leave Management Business Logic Layer
 * Enforces calendar working-day counting, overlap rejection, annual quota rules,
 * employee application submissions, and administrative review workflows.
 */

const Leave = (() => {
  'use strict';

  /**
   * Get yearly quota and remaining balance for an employee in a given calendar year.
   * @param {string} employeeId
   * @param {number} [year]
   * @returns {{quota: number, used: number, remaining: number}}
   */
  function getRemainingLeaveBalance(employeeId, year = new Date().getFullYear()) {
    const company = Storage.getCompanySettings();

    // Zero-value fix: agar quota 0 ho to 0 rehne do, sirf NaN ya negative par default use karo
    var quota = parseInt(company.yearlyLeaveQuota, 10);
    if (isNaN(quota) || quota < 0) {
      quota = 20;
    }

    const allLeaves = Storage.get(Storage.KEYS.LEAVES, []);
    const yearStr = String(year);

    // Sum working days of all approved leaves in this calendar year
    var approvedLeaves = [];
    for (var i = 0; i < allLeaves.length; i++) {
      var l = allLeaves[i];
      if (
        l.employeeId === employeeId &&
        l.status === 'approved' &&
        l.leaveType !== 'Unpaid' &&
        (l.startDate.startsWith(yearStr) || l.endDate.startsWith(yearStr))
      ) {
        approvedLeaves.push(l);
      }
    }

    var used = 0;
    for (var j = 0; j < approvedLeaves.length; j++) {
      used += (approvedLeaves[j].workingDays || 0);
    }
    const remaining = Math.max(0, quota - used);

    return { quota, used, remaining };
  }

  /**
   * Submit an employee leave application.
   * Leave apply karna: dates validate karo, quota check karo, overlap check karo,
   * phir record save karo aur admin ko review ke liye bhejo.
   * @param {Object} param0
   * @returns {{success: boolean, error?: string, leave?: Object}}
   */
  function applyLeave({ employeeId, leaveType, startDate, endDate, reason }) {
    if (!employeeId) return { success: false, error: 'Employee identification required.' };
    if (!leaveType) return { success: false, error: 'Please select a leave category.' };
    if (!startDate || !endDate) return { success: false, error: 'Both start and end dates are required.' };
    if (!reason || !reason.trim()) return { success: false, error: 'Please state a reason for your leave request.' };

    const start = Storage.parseLocalDate(startDate);
    const end = Storage.parseLocalDate(endDate);

    if (!start || !end) {
      return { success: false, error: 'Invalid date format provided.' };
    }

    if (start > end) {
      return { success: false, error: 'The start date cannot be after the end date.' };
    }

    // Require request to be within the same calendar year for consistent annual quota tracking
    if (start.getFullYear() !== end.getFullYear()) {
      return { success: false, error: 'Cross-year leave requests are not permitted. Please submit separate applications for each calendar year.' };
    }

    const company = Storage.getCompanySettings();
    const workingDaysConfig = company.workingDays || [1, 2, 3, 4, 5];

    // Calculate working days only (skips weekends and company non-working days)
    const workingDays = Storage.countWorkingDays(startDate, endDate, workingDaysConfig);
    if (workingDays <= 0) {
      return { success: false, error: 'Selected date range contains no company working days (all selected dates fall on weekends or off-days).' };
    }

    // Check for overlapping leaves for this employee (blocks overlap with pending and approved requests)
    const allLeaves = Storage.get(Storage.KEYS.LEAVES, []);
    var existingRequests = [];
    for (var i = 0; i < allLeaves.length; i++) {
      if (allLeaves[i].employeeId === employeeId &&
          (allLeaves[i].status === 'pending' || allLeaves[i].status === 'approved')) {
        existingRequests.push(allLeaves[i]);
      }
    }

    var hasOverlap = false;
    for (var j = 0; j < existingRequests.length; j++) {
      if (Storage.isDateOverlap(startDate, endDate, existingRequests[j].startDate, existingRequests[j].endDate)) {
        hasOverlap = true;
        break;
      }
    }

    if (hasOverlap) {
      return { success: false, error: 'This date range overlaps with an existing pending or approved leave request.' };
    }

    // Verify annual quota limit unless applying for Unpaid leave
    if (leaveType !== 'Unpaid') {
      const balance = getRemainingLeaveBalance(employeeId, start.getFullYear());
      if (workingDays > balance.remaining) {
        return {
          success: false,
          error: 'Requested duration (' + workingDays + ' working days) exceeds your remaining yearly leave balance of ' + balance.remaining + ' days.'
        };
      }
    }

    const newLeave = {
      id: Storage.generateId('lv'),
      employeeId,
      leaveType,
      startDate,
      endDate,
      workingDays,
      reason: reason.trim(),
      status: 'pending',
      adminComment: '',
      createdAt: new Date().toISOString()
    };

    allLeaves.push(newLeave);
    Storage.set(Storage.KEYS.LEAVES, allLeaves);

    return { success: true, leave: newLeave };
  }

  /**
   * Review a leave application (Admin decision: 'approved' | 'rejected').
   * @param {string} leaveId
   * @param {string} decision - 'approved' | 'rejected'
   * @param {string} adminComment
   * @returns {{success: boolean, error?: string, leave?: Object}}
   */
  function reviewLeave(leaveId, decision, adminComment = '') {
    if (!['approved', 'rejected'].includes(decision)) {
      return { success: false, error: 'Decision must be either "approved" or "rejected".' };
    }

    const allLeaves = Storage.get(Storage.KEYS.LEAVES, []);
    var index = -1;
    for (var i = 0; i < allLeaves.length; i++) {
      if (allLeaves[i].id === leaveId) {
        index = i;
        break;
      }
    }

    if (index === -1) {
      return { success: false, error: 'Leave request not found.' };
    }

    const leave = allLeaves[index];
    if (leave.status !== 'pending') {
      return { success: false, error: 'This request has already been ' + leave.status + ' and cannot be reviewed again.' };
    }

    // If approving, re-verify quota and overlaps
    if (decision === 'approved') {
      const start = Storage.parseLocalDate(leave.startDate);
      if (leave.leaveType !== 'Unpaid') {
        const balance = getRemainingLeaveBalance(leave.employeeId, start ? start.getFullYear() : undefined);
        if (leave.workingDays > balance.remaining) {
          return { success: false, error: 'Cannot approve: Employee only has ' + balance.remaining + ' leave days remaining.' };
        }
      }

      // Re-verify overlap against other approved requests
      var otherApproved = [];
      for (var j = 0; j < allLeaves.length; j++) {
        if (allLeaves[j].id !== leave.id &&
            allLeaves[j].employeeId === leave.employeeId &&
            allLeaves[j].status === 'approved') {
          otherApproved.push(allLeaves[j]);
        }
      }
      var overlap = false;
      for (var k = 0; k < otherApproved.length; k++) {
        if (Storage.isDateOverlap(leave.startDate, leave.endDate, otherApproved[k].startDate, otherApproved[k].endDate)) {
          overlap = true;
          break;
        }
      }
      if (overlap) {
        return { success: false, error: 'Cannot approve: Overlaps with another approved leave.' };
      }
    }

    leave.status = decision;
    leave.adminComment = (adminComment || '').trim();
    leave.reviewedAt = new Date().toISOString();

    allLeaves[index] = leave;
    Storage.set(Storage.KEYS.LEAVES, allLeaves);

    return { success: true, leave };
  }

  /**
   * Retrieve all leave applications submitted by an employee.
   * @param {string} employeeId
   * @returns {Object[]} sorted newest first
   */
  function getLeavesByEmployee(employeeId) {
    const allLeaves = Storage.get(Storage.KEYS.LEAVES, []);
    var filtered = [];
    for (var i = 0; i < allLeaves.length; i++) {
      if (allLeaves[i].employeeId === employeeId) {
        filtered.push(allLeaves[i]);
      }
    }
    filtered.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    return filtered;
  }

  /**
   * Retrieve all leave applications with optional filtering.
   * @param {Object} [filters]
   * @returns {Object[]}
   */
  function getAllLeaves(filters = {}) {
    const allLeaves = Storage.get(Storage.KEYS.LEAVES, []);
    var filtered = allLeaves.slice(); // copy

    if (filters.status) {
      var tmp = [];
      for (var i = 0; i < filtered.length; i++) {
        if (filtered[i].status.toLowerCase() === filters.status.toLowerCase()) {
          tmp.push(filtered[i]);
        }
      }
      filtered = tmp;
    }

    if (filters.leaveType) {
      var tmp2 = [];
      for (var j = 0; j < filtered.length; j++) {
        if (filtered[j].leaveType === filters.leaveType) {
          tmp2.push(filtered[j]);
        }
      }
      filtered = tmp2;
    }

    if (filters.date) {
      var tmp3 = [];
      for (var k = 0; k < filtered.length; k++) {
        if (filtered[k].startDate <= filters.date && filtered[k].endDate >= filters.date) {
          tmp3.push(filtered[k]);
        }
      }
      filtered = tmp3;
    }

    filtered.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    return filtered;
  }

  /**
   * Count approved leave days for an employee falling inside a given calendar month.
   * Used for accurate salary deduction calculation (ensures approved leave is not docked as absent).
   * @param {string} employeeId
   * @param {number} year
   * @param {number} monthIndex
   * @returns {number}
   */
  function getApprovedLeaveDaysInMonth(employeeId, year, monthIndex) {
    const allLeaves = Storage.get(Storage.KEYS.LEAVES, []);
    var approved = [];
    for (var i = 0; i < allLeaves.length; i++) {
      if (allLeaves[i].employeeId === employeeId && allLeaves[i].status === 'approved') {
        approved.push(allLeaves[i]);
      }
    }
    if (!approved.length) return 0;

    const company = Storage.getCompanySettings();
    const workingDaysConfig = company.workingDays || [1, 2, 3, 4, 5];

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    let count = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, monthIndex, day);
      if (workingDaysConfig.includes(d.getDay())) {
        const dateStr = Storage.formatLocalDate(d);
        var hasApprovedLeave = false;
        for (var j = 0; j < approved.length; j++) {
          if (approved[j].startDate <= dateStr && approved[j].endDate >= dateStr) {
            hasApprovedLeave = true;
            break;
          }
        }
        if (hasApprovedLeave) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Check if an employee is on approved leave today.
   * @param {string} employeeId
   * @param {string} [dateStr]
   * @returns {boolean}
   */
  function isEmployeeOnLeaveOnDate(employeeId, dateStr = Storage.getTodayLocalDate()) {
    const allLeaves = Storage.get(Storage.KEYS.LEAVES, []);
    for (var i = 0; i < allLeaves.length; i++) {
      var l = allLeaves[i];
      if (l.employeeId === employeeId &&
          l.status === 'approved' &&
          l.startDate <= dateStr &&
          l.endDate >= dateStr) {
        return true;
      }
    }
    return false;
  }

  return {
    getRemainingLeaveBalance,
    applyLeave,
    reviewLeave,
    getLeavesByEmployee,
    getAllLeaves,
    getApprovedLeaveDaysInMonth,
    isEmployeeOnLeaveOnDate
  };
})();
