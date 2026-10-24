/**
 * HCM Lite — Payroll & Payslip Calculation Layer
 * Computes official monthly salary slips using exact hackathon formulas:
 * Daily salary = Monthly salary / Working days in the month
 * Deduction = Daily salary * (Absent days + 0.5 * Half-day count)
 * Net salary = Monthly salary - Deduction
 */

const Payslip = (() => {
  'use strict';

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  /**
   * Calculate full payroll metrics for an employee in a specific month and year.
   * @param {string} employeeId
   * @param {number} year
   * @param {number} monthIndex - 0 for Jan, 11 for Dec
   * @returns {Object|null}
   */
  function calculatePayslip(employeeId, year, monthIndex) {
    const employee = Employees.getEmployeeById(employeeId);
    if (!employee) return null;

    const company = Storage.getCompanySettings();
    const monthlySalary = Number(employee.monthlySalary) || 0;

    // Get attendance metrics
    const stats = Attendance.getMonthlyAttendanceStats(employeeId, year, monthIndex);
    const workingDays = stats.workingDays;
    const presentDays = stats.presentDays;
    const halfDays = stats.halfDays;
    const absentDays = stats.absentDays;

    // 1. Daily salary rate = Monthly salary / Working days in month (guard against div by zero)
    const dailySalary = workingDays > 0 ? (monthlySalary / workingDays) : 0;

    // 2. Absence deductions
    const absenceDeduction = dailySalary * absentDays;
    const halfDayDeduction = dailySalary * (0.5 * halfDays);
    const totalDeductions = absenceDeduction + halfDayDeduction;

    // 3. Net payable salary = Monthly salary - Total deductions
    const netSalary = Math.max(0, monthlySalary - totalDeductions);

    return {
      employee,
      company,
      year,
      monthIndex,
      monthName: MONTH_NAMES[monthIndex],
      monthlySalary,
      workingDays,
      presentDays,
      absentDays,
      halfDays,
      dailySalary,
      absenceDeduction,
      halfDayDeduction,
      totalDeductions,
      netSalary,
      amountInWords: Storage.amountToWords(netSalary),
      preparedDate: Storage.getTodayLocalDate()
    };
  }

  /**
   * Render the payslip document into the DOM elements on pages/payslip.html.
   * @param {Object} data - result of calculatePayslip
   */
  function renderPayslipDocument(data) {
    if (!data) return;

    // Company Header
    const compName = document.getElementById('payslipCompanyName');
    if (compName) compName.textContent = data.company.companyName || 'Acme Corporation';

    const compAddr = document.getElementById('payslipCompanyAddress');
    if (compAddr) compAddr.textContent = data.company.companyAddress || '45 Innovation Way, Suite 300, Karachi';

    const compContact = document.getElementById('payslipCompanyContact');
    if (compContact) compContact.textContent = `${data.company.companyEmail || 'hr@company.com'} · ${data.company.companyPhone || '+92 21 34567890'}`;

    const periodTitle = document.getElementById('payslipPeriodTitle');
    if (periodTitle) periodTitle.textContent = `Pay Period: ${data.monthName} ${data.year}`;

    const prepDate = document.getElementById('payslipPreparedDate');
    if (prepDate) prepDate.textContent = `${data.monthName} ${new Date(data.year, data.monthIndex + 1, 0).getDate()}, ${data.year}`;

    // Employee Meta
    const empName = document.getElementById('payslipEmpName');
    if (empName) empName.textContent = data.employee.fullName || '—';

    const empId = document.getElementById('payslipEmpId');
    if (empId) empId.textContent = data.employee.id || '—';

    const empDept = document.getElementById('payslipDept');
    if (empDept) empDept.textContent = data.employee.department || '—';

    const empDesig = document.getElementById('payslipDesignation');
    if (empDesig) empDesig.textContent = data.employee.jobTitle || '—';

    // Attendance Bar
    const elWorkDays = document.getElementById('payslipWorkingDays');
    if (elWorkDays) elWorkDays.textContent = data.workingDays;

    const elPresDays = document.getElementById('payslipPresentDays');
    if (elPresDays) elPresDays.textContent = data.presentDays;

    const elAbsDays = document.getElementById('payslipAbsentDays');
    if (elAbsDays) elAbsDays.textContent = data.absentDays;

    const elHalfDays = document.getElementById('payslipHalfDays');
    if (elHalfDays) elHalfDays.textContent = data.halfDays;

    const elDailyRate = document.getElementById('payslipDailyRate');
    if (elDailyRate) elDailyRate.textContent = Storage.formatCurrency(data.dailySalary);

    // Earnings
    const elBasic = document.getElementById('payslipBasicSalary');
    if (elBasic) elBasic.textContent = Storage.formatCurrency(data.monthlySalary);

    const elGross = document.getElementById('payslipGrossEarnings');
    if (elGross) elGross.textContent = Storage.formatCurrency(data.monthlySalary);

    // Deductions
    const elAbsDed = document.getElementById('payslipAbsenceDeduction');
    if (elAbsDed) elAbsDed.textContent = Storage.formatCurrency(data.absenceDeduction);

    const elHalfDed = document.getElementById('payslipHalfDayDeduction');
    if (elHalfDed) elHalfDed.textContent = Storage.formatCurrency(data.halfDayDeduction);

    const elTotDed = document.getElementById('payslipTotalDeductions');
    if (elTotDed) elTotDed.textContent = Storage.formatCurrency(data.totalDeductions);

    // Net Payable Banner
    const elNetSal = document.getElementById('payslipNetSalary');
    if (elNetSal) elNetSal.textContent = Storage.formatCurrency(data.netSalary);

    const elWords = document.getElementById('payslipAmountInWords');
    if (elWords) elWords.textContent = `Amount in words: ${data.amountInWords}`;
  }

  return {
    MONTH_NAMES,
    calculatePayslip,
    renderPayslipDocument
  };
})();
