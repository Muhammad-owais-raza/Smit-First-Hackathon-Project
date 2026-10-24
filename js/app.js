/**
 * HCM Lite — Master Application Controller & UI Binder
 * Orchestrates page initialization, form events, modals, notifications,
 * and live LocalStorage synchronization across all seven pages.
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Identify current page route
  const path = window.location.pathname;
  const isLoginPage = path.endsWith('index.html') || path.endsWith('/') || !path.includes('.html');

  if (isLoginPage) {
    initLoginPage();
  } else if (path.includes('admin.html')) {
    initAdminDashboard();
  } else if (path.includes('employees.html')) {
    initEmployeesPage();
  } else if (path.includes('leaves.html')) {
    initLeavesPage();
  } else if (path.includes('settings.html')) {
    initSettingsPage();
  } else if (path.includes('employee.html')) {
    initEmployeeDashboard();
  } else if (path.includes('payslip.html')) {
    initPayslipPage();
  }
});

// ============================================================================
// 1. LOGIN & FIRST-RUN SETUP (index.html)
// ============================================================================
function initLoginPage() {
  // If already logged in, redirect straight to the appropriate dashboard
  Auth.redirectIfLoggedIn();

  const isFirst = Auth.isFirstRun();
  const tabSignIn = document.getElementById('tabSignInLink');
  const tabSetup = document.getElementById('tabSetupLink');
  const loginTabContent = document.getElementById('login-tab-content');
  const setupTabContent = document.getElementById('setup-tab-content');

  function showTab(tab) {
    if (tab === 'setup') {
      if (loginTabContent) loginTabContent.style.display = 'none';
      if (setupTabContent) setupTabContent.style.display = 'block';
      if (tabSignIn) tabSignIn.classList.remove('active-login');
      if (tabSetup) tabSetup.classList.add('active-login');
    } else {
      if (loginTabContent) loginTabContent.style.display = 'block';
      if (setupTabContent) setupTabContent.style.display = 'none';
      if (tabSignIn) tabSignIn.classList.add('active-login');
      if (tabSetup) tabSetup.classList.remove('active-login');
    }
  }

  // If first-run, activate the Setup tab by default
  if (isFirst) {
    showTab('setup');
  } else {
    showTab('login');
  }

  if (tabSignIn) {
    tabSignIn.addEventListener('click', (e) => {
      e.preventDefault();
      showTab('login');
    });
  }
  if (tabSetup) {
    tabSetup.addEventListener('click', (e) => {
      e.preventDefault();
      showTab('setup');
    });
  }

  // --- Login Form Handler ---
  const loginForm = document.getElementById('loginForm');
  const loginFeedback = document.getElementById('loginFeedback');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loginFeedback) {
        loginFeedback.style.display = 'none';
        loginFeedback.textContent = '';
      }

      const email = (document.getElementById('loginEmail')?.value || '').trim();
      const password = document.getElementById('loginPassword')?.value || '';

      const submitBtn = document.getElementById('loginSubmitBtn');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await Auth.login(email, password);
        if (res.success) {
          if (res.user.role === 'admin') {
            window.location.href = 'pages/admin.html';
          } else {
            window.location.href = 'pages/employee.html';
          }
        } else {
          if (loginFeedback) {
            loginFeedback.className = 'form-feedback error';
            loginFeedback.style.display = 'block';
            loginFeedback.textContent = res.error;
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // --- First-Run Setup Form Handler ---
  const setupForm = document.getElementById('setupForm');
  const setupFeedback = document.getElementById('setupFeedback');

  if (setupForm) {
    setupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (setupFeedback) {
        setupFeedback.style.display = 'none';
        setupFeedback.textContent = '';
      }

      const companyName = (document.getElementById('setupCompanyName')?.value || '').trim();
      const adminFullName = (document.getElementById('setupAdminName')?.value || '').trim();
      const adminEmail = (document.getElementById('setupAdminEmail')?.value || '').trim();
      const adminPassword = document.getElementById('setupAdminPassword')?.value || '';
      const confirmPassword = document.getElementById('setupConfirmPassword')?.value || '';

      const submitBtn = document.getElementById('setupSubmitBtn');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await Auth.setupCompanyAndAdmin({
          companyName,
          adminFullName,
          adminEmail,
          adminPassword,
          confirmPassword
        });

        if (res.success) {
          window.location.href = 'pages/admin.html';
        } else {
          if (setupFeedback) {
            setupFeedback.className = 'form-feedback error';
            setupFeedback.style.display = 'block';
            setupFeedback.textContent = res.error;
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
}

// ============================================================================
// 2. COMMON SHELL INITIALIZATION (For all authenticated pages)
// ============================================================================
function initCommonShell(allowedRoles = ['admin', 'employee']) {
  const user = Auth.requireAuth(allowedRoles);

  // Setup User Profile details in Sidebar & Topbar
  const initials = getInitials(user.fullName);
  document.querySelectorAll('.user-avatar, .avatar').forEach(el => {
    el.textContent = initials;
  });

  document.querySelectorAll('.user-name, .profile-name').forEach(el => {
    el.textContent = user.fullName;
  });

  document.querySelectorAll('.user-role-label').forEach(el => {
    el.textContent = user.email;
  });

  document.querySelectorAll('.profile-role').forEach(el => {
    el.textContent = user.role === 'admin' ? 'Administrator' : (user.jobTitle || 'Employee');
  });

  // Setup Logout button listeners
  document.querySelectorAll('.logout-btn, a[href*="index.html"]:not(.role-switcher-badge)').forEach(btn => {
    if (btn.classList.contains('logout-btn') || btn.title === 'Sign Out') {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
      });
    }
  });

  return user;
}

// ============================================================================
// 3. ADMIN DASHBOARD (pages/admin.html)
// ============================================================================
function initAdminDashboard() {
  const user = initCommonShell(['admin']);

  // Date banner
  const dateBadge = document.getElementById('currentDateBadge');
  if (dateBadge) {
    const now = new Date();
    dateBadge.querySelector('span').textContent = `${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · Working Day`;
  }

  // 1. KPI Cards
  updateAdminKPIs();

  // 2. Attendance Overview Bar Chart
  renderAttendanceOverviewChart();

  // 3. Department Overview
  renderDepartmentOverview();

  // 4. Today's Attendance Table
  renderTodayAttendanceTable();

  // 5. Pending Leaves Card
  renderPendingLeavesCard();

  // 6. Smart Helper Chat
  SmartHelper.setupChatUI({
    formId: 'helperForm',
    inputId: 'helperInput',
    sendBtnId: 'sendHelperBtn',
    containerId: 'adminChatContainer',
    chipsSelector: '#smart-helper .chip',
    currentUser: user
  });

  // 7. Announcements
  const announcementsContainer = document.getElementById('announcementsEmptyState')?.parentElement;
  if (announcementsContainer) {
    Announcements.renderAnnouncementsList(announcementsContainer, true);
  }

  // Post Announcement Action
  const postBtn = document.getElementById('postAnnouncementBtn');
  if (postBtn) {
    postBtn.addEventListener('click', () => {
      const title = prompt('Enter Announcement Title:');
      if (!title || !title.trim()) return;
      const message = prompt('Enter Announcement Message:');
      if (!message || !message.trim()) return;

      Announcements.createAnnouncement({
        title,
        message,
        authorId: user.id,
        authorName: user.fullName
      });

      if (announcementsContainer) {
        Announcements.renderAnnouncementsList(announcementsContainer, true);
      }
    });
  }
}

function updateAdminKPIs() {
  const staff = Employees.getAllEmployees();
  const todayAttendance = Attendance.getCompanyAttendanceToday();
  const todayStr = Storage.getTodayLocalDate();

  const onLeaveCount = staff.filter(e => Leave.isEmployeeOnLeaveOnDate(e.id, todayStr)).length;
  const lateCount = todayAttendance.filter(a => a.isLate).length;

  const kpiTotal = document.getElementById('kpiTotalEmployees');
  if (kpiTotal) kpiTotal.textContent = staff.length;

  const kpiPres = document.getElementById('kpiPresentToday');
  if (kpiPres) kpiPres.textContent = todayAttendance.length;

  const kpiLeave = document.getElementById('kpiOnLeave');
  if (kpiLeave) kpiLeave.textContent = onLeaveCount;

  const kpiLate = document.getElementById('kpiLateArrivals');
  if (kpiLate) kpiLate.textContent = lateCount;
}

function renderAttendanceOverviewChart() {
  const summary = Attendance.getWeeklyAttendanceSummary();
  const barChart = document.querySelector('.bar-chart-preview');
  if (!barChart) return;

  const maxCount = Math.max(1, ...summary.map(s => s.present + s.absent));

  barChart.innerHTML = summary.map(s => {
    const presPct = Math.round((s.present / maxCount) * 100);
    const latePct = Math.round((s.late / maxCount) * 100);
    const absPct = Math.round((s.absent / maxCount) * 100);

    return `
      <div class="chart-bar-group">
        <div class="bar-cluster">
          <div class="bar-pillar present" style="height: ${Math.max(4, presPct)}%;" title="Present: ${s.present}"></div>
          <div class="bar-pillar late" style="height: ${Math.max(4, latePct)}%;" title="Late: ${s.late}"></div>
          <div class="bar-pillar absent" style="height: ${Math.max(4, absPct)}%;" title="Absent: ${s.absent}"></div>
        </div>
        <span class="bar-label">${s.dayName}</span>
      </div>
    `;
  }).join('');
}

function renderDepartmentOverview() {
  const staff = Employees.getAllEmployees();
  const deptBox = document.querySelector('.dept-distribution-box');
  if (!deptBox) return;

  const counts = {};
  staff.forEach(e => {
    const d = e.department || 'Other';
    counts[d] = (counts[d] || 0) + 1;
  });

  const depts = Object.keys(counts);
  if (depts.length === 0) return;

  const total = staff.length || 1;
  const colors = ['#2563EB', '#60A5FA', '#10B981', '#F59E0B', '#8B5CF6'];

  // Segments
  const stack = deptBox.querySelector('.dept-bar-stack');
  if (stack) {
    stack.innerHTML = depts.map((d, i) => {
      const pct = Math.round((counts[d] / total) * 100);
      return `<div class="dept-segment" style="width: ${pct}%; background-color: ${colors[i % colors.length]}; opacity: 0.85;" title="${d}: ${counts[d]} (${pct}%)"></div>`;
    }).join('');
  }

  // Legend
  const legend = deptBox.querySelector('.dept-legend-list');
  if (legend) {
    legend.innerHTML = depts.map((d, i) => `
      <div class="dept-legend-row">
        <span class="dept-legend-name">
          <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${colors[i % colors.length]};"></span>
          ${escapeHTML(d)}
        </span>
        <span class="dept-legend-count">${counts[d]} staff</span>
      </div>
    `).join('');
  }
}

function renderTodayAttendanceTable() {
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;

  const records = Attendance.getCompanyAttendanceToday();
  if (records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 0;">
          <div class="empty-state" id="attendanceEmptyState">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h4 class="empty-state-title">No attendance records today</h4>
            <p class="empty-state-desc">Attendance records will appear here automatically when employees check in through their personal dashboard.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = records.map(r => {
    const emp = Employees.getEmployeeById(r.employeeId);
    const name = emp ? emp.fullName : r.employeeId;
    const dept = emp ? emp.department : 'General';
    const initials = getInitials(name);
    const durationStr = r.workMinutes ? Storage.formatHoursMinutes(r.workMinutes) : 'In Progress';

    let badgeClass = 'badge-success';
    let statusText = 'Present';

    if (r.status === 'half-day') {
      badgeClass = 'badge-warning';
      statusText = 'Half Day';
    } else if (r.isLate) {
      badgeClass = 'badge-warning';
      statusText = 'Late';
    }

    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="cell-avatar">${initials}</div>
            <div class="cell-info">
              <span class="cell-name">${escapeHTML(name)}</span>
              <span class="cell-sub">${r.employeeId}</span>
            </div>
          </div>
        </td>
        <td>${escapeHTML(dept)}</td>
        <td><strong>${r.checkIn || '—'}</strong></td>
        <td>${r.checkOut || '—'}</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td style="text-align: right; color: var(--color-text-secondary); font-size: var(--font-size-xs);">${durationStr}</td>
      </tr>
    `;
  }).join('');
}

function renderPendingLeavesCard() {
  const container = document.getElementById('pendingLeavesCard')?.querySelector('.card-body');
  if (!container) return;

  const pending = Leave.getAllLeaves({ status: 'pending' }).slice(0, 4);
  if (pending.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-6) 0;">
        <div class="empty-state-icon" style="background-color: var(--color-warning-bg); color: var(--color-warning);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <h4 class="empty-state-title">No pending requests</h4>
        <p class="empty-state-desc">Employee leave applications requiring review will appear here.</p>
        <div class="empty-state-action">
          <a href="leaves.html" class="btn btn-sm btn-secondary">Review Leave Queue</a>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = pending.map(l => {
    const emp = Employees.getEmployeeById(l.employeeId);
    const name = emp ? emp.fullName : l.employeeId;

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border-subtle);">
        <div>
          <strong style="font-size: var(--font-size-sm); color: var(--color-text-main);">${escapeHTML(name)}</strong>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${l.leaveType} · ${l.startDate} to ${l.endDate} (${l.workingDays} days)</div>
        </div>
        <a href="leaves.html#reviewLeaveModal" class="btn btn-sm btn-outline" style="padding: 4px 10px;">Review</a>
      </div>
    `;
  }).join('') + `
    <div style="padding: var(--space-3) var(--space-4); text-align: center;">
      <a href="leaves.html" style="font-size: var(--font-size-xs); font-weight: 600; color: var(--color-primary);">Go to Leave Management →</a>
    </div>
  `;
}

// ============================================================================
// 4. EMPLOYEE MANAGEMENT (pages/employees.html)
// ============================================================================
let editingEmployeeId = null;

function initEmployeesPage() {
  initCommonShell(['admin']);

  // Summary Metrics
  updateEmployeePageMetrics();

  // Render Table
  renderEmployeesTable();

  // Filter Listeners
  const searchInput = document.getElementById('employeeSearchInput');
  const deptFilter = document.getElementById('deptFilter');
  const statusFilter = document.getElementById('statusFilter');

  if (searchInput) searchInput.addEventListener('input', renderEmployeesTable);
  if (deptFilter) deptFilter.addEventListener('change', renderEmployeesTable);
  if (statusFilter) statusFilter.addEventListener('change', renderEmployeesTable);

  // Add Employee Button (Resets form for new addition)
  const openAddBtn = document.getElementById('openAddEmployeeBtn');
  if (openAddBtn) {
    openAddBtn.addEventListener('click', () => {
      resetEmployeeForm();
    });
  }

  // Employee Form Submit
  const empForm = document.getElementById('employeeForm');
  const empFeedback = document.getElementById('empFormFeedback');

  if (empForm) {
    empForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (empFeedback) {
        empFeedback.style.display = 'none';
        empFeedback.textContent = '';
      }

      const fullName = (document.getElementById('empFullName')?.value || '').trim();
      const email = (document.getElementById('empEmail')?.value || '').trim();
      const department = document.getElementById('empDepartment')?.value || '';
      const jobTitle = (document.getElementById('empJobTitle')?.value || '').trim();
      const monthlySalary = document.getElementById('empSalary')?.value || '';
      const password = document.getElementById('empPassword')?.value || '';
      const confirmPassword = document.getElementById('empConfirmPassword')?.value || '';

      const saveBtn = document.getElementById('saveEmployeeBtn');
      if (saveBtn) saveBtn.disabled = true;

      try {
        let res;
        if (editingEmployeeId) {
          res = await Employees.updateEmployee(editingEmployeeId, {
            fullName,
            email,
            department,
            jobTitle,
            monthlySalary,
            password,
            confirmPassword
          });
        } else {
          res = await Employees.createEmployee({
            fullName,
            email,
            department,
            jobTitle,
            monthlySalary,
            password,
            confirmPassword
          });
        }

        if (res.success) {
          // Close modal
          window.location.hash = '#';
          resetEmployeeForm();
          updateEmployeePageMetrics();
          renderEmployeesTable();
        } else {
          if (empFeedback) {
            empFeedback.className = 'form-feedback error';
            empFeedback.style.display = 'block';
            empFeedback.textContent = res.error;
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }
    });
  }

  // Cancel Button in modal
  const cancelBtn = document.getElementById('cancelEmployeeBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      resetEmployeeForm();
    });
  }
}

function updateEmployeePageMetrics() {
  const staff = Employees.getAllEmployees();
  const depts = new Set(staff.map(e => e.department)).size;
  const active = staff.filter(e => e.active !== false).length;

  const elTot = document.getElementById('metricTotalEmployees');
  if (elTot) elTot.textContent = staff.length;

  const elDept = document.getElementById('metricTotalDepartments');
  if (elDept) elDept.textContent = depts;

  const elAct = document.getElementById('metricActiveEmployees');
  if (elAct) elAct.textContent = active;
}

function renderEmployeesTable() {
  const tbody = document.getElementById('employeesTableBody');
  if (!tbody) return;

  const search = document.getElementById('employeeSearchInput')?.value || '';
  const dept = document.getElementById('deptFilter')?.value || '';
  const status = document.getElementById('statusFilter')?.value || '';

  const all = Employees.getAllEmployees();
  const filtered = Employees.filterEmployees(all, search, dept, status);

  const countBadge = document.getElementById('employeeCountBadge');
  if (countBadge) countBadge.textContent = `${filtered.length} Employees Listed`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="padding: 0;">
          <div class="empty-state" id="employeesEmptyState">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="32" height="32">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h4 class="empty-state-title">No employees found</h4>
            <p class="empty-state-desc">Your directory has no records matching the selected search or filter criteria.</p>
            <div class="empty-state-action">
              <a href="#addEmployeeModal" class="btn btn-primary" onclick="window.EmployeesFormReset()">
                Add New Employee
              </a>
            </div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(emp => {
    const initials = getInitials(emp.fullName);
    const statusBadge = emp.active !== false 
      ? '<span class="badge badge-success">Active</span>' 
      : '<span class="badge badge-danger">Inactive</span>';

    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="cell-avatar">${initials}</div>
            <div class="cell-info">
              <span class="cell-name">${escapeHTML(emp.fullName)}</span>
              <span class="cell-sub">${escapeHTML(emp.jobTitle || 'Staff')}</span>
            </div>
          </div>
        </td>
        <td><code>${emp.id}</code></td>
        <td>${escapeHTML(emp.department)}</td>
        <td>${escapeHTML(emp.email)}</td>
        <td><strong>${Storage.formatCurrency(emp.monthlySalary)}</strong></td>
        <td>${statusBadge}</td>
        <td>
          <div class="table-actions">
            <button type="button" class="btn btn-sm btn-secondary" data-edit-emp="${emp.id}" title="Edit details">
              Edit
            </button>
            <button type="button" class="btn btn-sm btn-ghost" data-delete-emp="${emp.id}" style="color: var(--color-error);" title="Remove employee">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach Edit and Delete listeners
  tbody.querySelectorAll('[data-edit-emp]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-emp');
      openEditEmployee(id);
    });
  });

  tbody.querySelectorAll('[data-delete-emp]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete-emp');
      const emp = Employees.getEmployeeById(id);
      if (confirm(`Are you sure you want to delete employee "${emp?.fullName}" (${id})? This will also remove their associated attendance logs and leave requests.`)) {
        Employees.deleteEmployee(id);
        updateEmployeePageMetrics();
        renderEmployeesTable();
      }
    });
  });
}

function openEditEmployee(id) {
  const emp = Employees.getEmployeeById(id);
  if (!emp) return;

  editingEmployeeId = id;
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) modalTitle.textContent = 'Edit Employee Details';

  document.getElementById('empFullName').value = emp.fullName || '';
  document.getElementById('empEmail').value = emp.email || '';
  document.getElementById('empDepartment').value = emp.department || '';
  document.getElementById('empJobTitle').value = emp.jobTitle || '';
  document.getElementById('empSalary').value = emp.monthlySalary || '';
  document.getElementById('empPassword').value = '';
  document.getElementById('empConfirmPassword').value = '';

  const saveBtn = document.getElementById('saveEmployeeBtn');
  if (saveBtn) saveBtn.textContent = 'Update Employee';

  window.location.hash = '#addEmployeeModal';
}

function resetEmployeeForm() {
  editingEmployeeId = null;
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) modalTitle.textContent = 'Add New Employee';

  const form = document.getElementById('employeeForm');
  if (form) form.reset();

  const saveBtn = document.getElementById('saveEmployeeBtn');
  if (saveBtn) saveBtn.textContent = 'Save Employee';

  const feedback = document.getElementById('empFormFeedback');
  if (feedback) feedback.style.display = 'none';
}
window.EmployeesFormReset = resetEmployeeForm;

// ============================================================================
// 5. LEAVE MANAGEMENT (pages/leaves.html)
// ============================================================================
let activeReviewLeaveId = null;

function initLeavesPage() {
  initCommonShell(['admin']);

  // Summary Metrics
  updateLeavesPageMetrics();

  // Render Table
  renderLeavesTable();

  // Filters
  const statusFilter = document.getElementById('leaveStatusFilter');
  const typeFilter = document.getElementById('leaveTypeFilter');
  const dateFilter = document.getElementById('leaveDateFilter');

  if (statusFilter) statusFilter.addEventListener('change', renderLeavesTable);
  if (typeFilter) typeFilter.addEventListener('change', renderLeavesTable);
  if (dateFilter) dateFilter.addEventListener('change', renderLeavesTable);

  // Review Modal Decision Actions
  const approveBtn = document.getElementById('approveLeaveBtn');
  const rejectBtn = document.getElementById('rejectLeaveBtn');
  const reviewFeedback = document.getElementById('reviewFeedback');

  if (approveBtn) {
    approveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleReviewDecision('approved');
    });
  }

  if (rejectBtn) {
    rejectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleReviewDecision('rejected');
    });
  }

  function handleReviewDecision(decision) {
    if (!activeReviewLeaveId) return;
    const comment = document.getElementById('adminLeaveComment')?.value || '';

    const res = Leave.reviewLeave(activeReviewLeaveId, decision, comment);
    if (res.success) {
      window.location.hash = '#';
      activeReviewLeaveId = null;
      updateLeavesPageMetrics();
      renderLeavesTable();
    } else {
      if (reviewFeedback) {
        reviewFeedback.className = 'form-feedback error';
        reviewFeedback.style.display = 'block';
        reviewFeedback.textContent = res.error;
      }
    }
  }
}

function updateLeavesPageMetrics() {
  const all = Leave.getAllLeaves();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentYear = String(new Date().getFullYear());

  const pendingCount = all.filter(l => l.status === 'pending').length;
  const approvedCount = all.filter(l => l.status === 'approved' && l.startDate.startsWith(`${currentYear}-${currentMonth}`)).length;
  const rejectedCount = all.filter(l => l.status === 'rejected').length;

  const elPen = document.getElementById('metricPendingLeaves');
  if (elPen) elPen.textContent = pendingCount;

  const elApp = document.getElementById('metricApprovedLeaves');
  if (elApp) elApp.textContent = approvedCount;

  const elRej = document.getElementById('metricRejectedLeaves');
  if (elRej) elRej.textContent = rejectedCount;
}

function renderLeavesTable() {
  const tbody = document.getElementById('leaveRequestsTableBody');
  if (!tbody) return;

  const status = document.getElementById('leaveStatusFilter')?.value || '';
  const leaveType = document.getElementById('leaveTypeFilter')?.value || '';
  const date = document.getElementById('leaveDateFilter')?.value || '';

  const list = Leave.getAllLeaves({ status, leaveType, date });

  const badgeCount = document.getElementById('leavesCountBadge');
  if (badgeCount) badgeCount.textContent = `${list.length} Requests in Queue`;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding: 0;">
          <div class="empty-state" id="leaveRequestsEmptyState">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <h4 class="empty-state-title">No leave requests found</h4>
            <p class="empty-state-desc">No leave applications matched your chosen filter options.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(l => {
    const emp = Employees.getEmployeeById(l.employeeId);
    const name = emp ? emp.fullName : l.employeeId;
    const appliedOn = l.createdAt ? l.createdAt.slice(0, 10) : '—';

    let badge = '<span class="badge badge-warning">Pending</span>';
    if (l.status === 'approved') badge = '<span class="badge badge-success">Approved</span>';
    if (l.status === 'rejected') badge = '<span class="badge badge-danger">Rejected</span>';

    const actionBtn = l.status === 'pending'
      ? `<button type="button" class="btn btn-sm btn-primary" data-review-leave="${l.id}">Review</button>`
      : `<button type="button" class="btn btn-sm btn-ghost" data-review-leave="${l.id}">Details</button>`;

    return `
      <tr>
        <td><strong>${escapeHTML(name)}</strong></td>
        <td>${l.leaveType}</td>
        <td>${l.startDate}</td>
        <td>${l.endDate}</td>
        <td><strong>${l.workingDays} days</strong></td>
        <td>${appliedOn}</td>
        <td>${badge}</td>
        <td style="text-align: right;">${actionBtn}</td>
      </tr>
    `;
  }).join('');

  // Attach Review button listeners
  tbody.querySelectorAll('[data-review-leave]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-review-leave');
      openReviewLeaveModal(id);
    });
  });
}

function openReviewLeaveModal(id) {
  const all = Leave.getAllLeaves();
  const leave = all.find(l => l.id === id);
  if (!leave) return;

  activeReviewLeaveId = id;
  const emp = Employees.getEmployeeById(leave.employeeId);

  const appName = document.getElementById('reviewApplicantName');
  if (appName) appName.textContent = emp ? emp.fullName : leave.employeeId;

  const appDept = document.getElementById('reviewApplicantDept');
  if (appDept) appDept.textContent = `${emp?.department || 'General'} · ${leave.employeeId}`;

  const lType = document.getElementById('reviewLeaveType');
  if (lType) lType.textContent = leave.leaveType;

  const dRange = document.getElementById('reviewDateRange');
  if (dRange) dRange.textContent = `${leave.startDate} to ${leave.endDate}`;

  const wDays = document.getElementById('reviewWorkingDaysCount');
  if (wDays) wDays.textContent = `${leave.workingDays} days`;

  const reasonBox = document.getElementById('reviewApplicantReason');
  if (reasonBox) reasonBox.textContent = leave.reason || 'No reason specified.';

  const commentInput = document.getElementById('adminLeaveComment');
  if (commentInput) commentInput.value = leave.adminComment || '';

  const statusBadge = document.getElementById('reviewLeaveStatus');
  if (statusBadge) {
    statusBadge.className = leave.status === 'approved' ? 'badge badge-success' : (leave.status === 'rejected' ? 'badge badge-danger' : 'badge badge-warning');
    statusBadge.textContent = leave.status.toUpperCase();
  }

  const approveBtn = document.getElementById('approveLeaveBtn');
  const rejectBtn = document.getElementById('rejectLeaveBtn');
  if (approveBtn && rejectBtn) {
    if (leave.status !== 'pending') {
      approveBtn.style.display = 'none';
      rejectBtn.style.display = 'none';
    } else {
      approveBtn.style.display = 'inline-flex';
      rejectBtn.style.display = 'inline-flex';
    }
  }

  const feedback = document.getElementById('reviewFeedback');
  if (feedback) feedback.style.display = 'none';

  window.location.hash = '#reviewLeaveModal';
}

// ============================================================================
// 6. COMPANY SETTINGS (pages/settings.html)
// ============================================================================
function initSettingsPage() {
  initCommonShell(['admin']);

  const settings = Storage.getCompanySettings();

  // Populate Form Fields
  const cName = document.getElementById('companyName');
  if (cName) cName.value = settings.companyName || '';

  const cEmail = document.getElementById('companyEmail');
  if (cEmail) cEmail.value = settings.companyEmail || '';

  const cAddress = document.getElementById('companyAddress');
  if (cAddress) cAddress.value = settings.companyAddress || '';

  const cPhone = document.getElementById('companyPhone');
  if (cPhone) cPhone.value = settings.companyPhone || '';

  const officeStart = document.getElementById('officeStartTime');
  if (officeStart) officeStart.value = settings.officeStartTime || '09:00';

  const grace = document.getElementById('gracePeriod');
  if (grace) grace.value = settings.gracePeriod || 15;

  const dailyHours = document.getElementById('dailyWorkHours');
  if (dailyHours) dailyHours.value = settings.dailyWorkHours || 8;

  const quota = document.getElementById('yearlyLeaveQuota');
  if (quota) quota.value = settings.yearlyLeaveQuota || 20;

  const policy = document.getElementById('leavePolicyDescription');
  if (policy) policy.value = settings.leavePolicyDescription || '';

  // Working days checkboxes
  const workingDays = settings.workingDays || [1, 2, 3, 4, 5];
  const dayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };

  document.querySelectorAll('input[name="workingDays"]').forEach(cb => {
    const val = dayMap[cb.value];
    cb.checked = workingDays.includes(val);
  });

  // Save Settings Form
  const form = document.getElementById('settingsForm');
  const feedback = document.getElementById('settingsFeedback');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const selectedDays = [];
      document.querySelectorAll('input[name="workingDays"]:checked').forEach(cb => {
        selectedDays.push(dayMap[cb.value]);
      });

      const updated = {
        companyName: (document.getElementById('companyName')?.value || '').trim(),
        companyEmail: (document.getElementById('companyEmail')?.value || '').trim(),
        companyAddress: (document.getElementById('companyAddress')?.value || '').trim(),
        companyPhone: (document.getElementById('companyPhone')?.value || '').trim(),
        officeStartTime: document.getElementById('officeStartTime')?.value || '09:00',
        gracePeriod: parseInt(document.getElementById('gracePeriod')?.value, 10) || 15,
        dailyWorkHours: parseInt(document.getElementById('dailyWorkHours')?.value, 10) || 8,
        workingDays: selectedDays,
        yearlyLeaveQuota: parseInt(document.getElementById('yearlyLeaveQuota')?.value, 10) || 20,
        leavePolicyDescription: (document.getElementById('leavePolicyDescription')?.value || '').trim()
      };

      Storage.saveCompanySettings(updated);

      if (feedback) {
        feedback.style.display = 'block';
        feedback.className = 'form-feedback success';
        feedback.textContent = 'Company settings saved successfully!';
        setTimeout(() => {
          feedback.style.display = 'none';
        }, 4000);
      }
    });
  }
}

// ============================================================================
// 7. EMPLOYEE DASHBOARD (pages/employee.html)
// ============================================================================
function initEmployeeDashboard() {
  const user = initCommonShell(['employee', 'admin']);

  // Welcome Date & Name
  const welcomeDate = document.getElementById('empCurrentDateBadge');
  if (welcomeDate) {
    const now = new Date();
    welcomeDate.querySelector('span').textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  }

  // Attendance Card State
  updateEmployeeAttendanceCard(user.id);

  // Check In & Check Out Button Handlers
  const checkInBtn = document.getElementById('checkInButton');
  const checkOutBtn = document.getElementById('checkOutButton');

  if (checkInBtn) {
    checkInBtn.addEventListener('click', () => {
      const res = Attendance.checkIn(user.id);
      if (res.success) {
        updateEmployeeAttendanceCard(user.id);
        updateEmployeeKPIs(user.id);
        renderMyAttendanceTable(user.id);
      } else {
        alert(res.error);
      }
    });
  }

  if (checkOutBtn) {
    checkOutBtn.addEventListener('click', () => {
      const res = Attendance.checkOut(user.id);
      if (res.success) {
        updateEmployeeAttendanceCard(user.id);
        updateEmployeeKPIs(user.id);
        renderMyAttendanceTable(user.id);
      } else {
        alert(res.error);
      }
    });
  }

  // Personal KPIs
  updateEmployeeKPIs(user.id);

  // My Attendance Table
  renderMyAttendanceTable(user.id);

  // My Leaves Table
  renderMyLeavesTable(user.id);

  // Apply Leave Form & Dynamic Working Days Calculator
  setupLeaveApplicationForm(user.id);

  // Smart Helper
  SmartHelper.setupChatUI({
    formId: 'empHelperForm',
    inputId: 'empHelperInput',
    sendBtnId: 'empSendHelperBtn',
    containerId: 'empChatContainer',
    chipsSelector: '#smart-helper .chip',
    currentUser: user
  });

  // Announcements
  const annContainer = document.getElementById('empAnnouncementsEmptyState')?.parentElement;
  if (annContainer) {
    Announcements.renderAnnouncementsList(annContainer, false);
  }
}

function updateEmployeeAttendanceCard(employeeId) {
  const todayRecord = Attendance.getTodayAttendance(employeeId);
  const statusBadge = document.getElementById('todayStatus');
  const checkInDisp = document.getElementById('displayCheckIn');
  const checkOutDisp = document.getElementById('displayCheckOut');
  const hoursDisp = document.getElementById('displayWorkHours');
  const inBtn = document.getElementById('checkInButton');
  const outBtn = document.getElementById('checkOutButton');

  if (!todayRecord) {
    if (statusBadge) {
      statusBadge.className = 'badge badge-neutral';
      statusBadge.innerHTML = '<span class="badge-dot-indicator"></span> Not Checked In';
    }
    if (checkInDisp) checkInDisp.textContent = '—:—';
    if (checkOutDisp) checkOutDisp.textContent = '—:—';
    if (hoursDisp) hoursDisp.textContent = '0h 00m';
    if (inBtn) inBtn.disabled = false;
    if (outBtn) {
      outBtn.disabled = true;
      outBtn.classList.add('disabled');
    }
    return;
  }

  // Checked In
  if (checkInDisp) checkInDisp.textContent = todayRecord.checkIn || '—:—';
  if (checkOutDisp) checkOutDisp.textContent = todayRecord.checkOut || '—:—';

  const duration = todayRecord.workMinutes || 0;
  if (hoursDisp) hoursDisp.textContent = Storage.formatHoursMinutes(duration);

  if (todayRecord.checkOut) {
    // Both In & Out completed
    if (statusBadge) {
      statusBadge.className = todayRecord.status === 'half-day' ? 'badge badge-warning' : 'badge badge-success';
      statusBadge.innerHTML = `<span class="badge-dot-indicator"></span> ${todayRecord.status.toUpperCase()}`;
    }
    if (inBtn) inBtn.disabled = true;
    if (outBtn) {
      outBtn.disabled = true;
      outBtn.classList.add('disabled');
    }
  } else {
    // Checked In, awaiting Check Out
    if (statusBadge) {
      statusBadge.className = todayRecord.isLate ? 'badge badge-warning' : 'badge badge-success';
      statusBadge.innerHTML = `<span class="badge-dot-indicator"></span> ${todayRecord.isLate ? 'CHECKED IN (LATE)' : 'CHECKED IN'}`;
    }
    if (inBtn) inBtn.disabled = true;
    if (outBtn) {
      outBtn.disabled = false;
      outBtn.classList.remove('disabled');
    }
  }
}

function updateEmployeeKPIs(employeeId) {
  const now = new Date();
  const stats = Attendance.getMonthlyAttendanceStats(employeeId, now.getFullYear(), now.getMonth());
  const balance = Leave.getRemainingLeaveBalance(employeeId, now.getFullYear());

  const elPres = document.getElementById('empPresentDays');
  if (elPres) elPres.textContent = stats.presentDays;

  const elAbs = document.getElementById('empAbsentDays');
  if (elAbs) elAbs.textContent = stats.absentDays;

  const elLate = document.getElementById('empLateDays');
  if (elLate) elLate.textContent = stats.lateDays;

  const elLeave = document.getElementById('empRemainingLeaves');
  if (elLeave) elLeave.textContent = balance.remaining;

  const quotaBadge = document.getElementById('availableQuotaBadge');
  if (quotaBadge) quotaBadge.textContent = `Quota: ${balance.remaining} days`;
}

function renderMyAttendanceTable(employeeId) {
  const tbody = document.getElementById('myAttendanceTableBody');
  if (!tbody) return;

  const history = Attendance.getEmployeeAttendanceHistory(employeeId);
  if (history.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 0;">
          <div class="empty-state" id="myAttendanceEmptyState">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <h4 class="empty-state-title">No attendance history</h4>
            <p class="empty-state-desc">Daily time logs will appear here once you check in each morning.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = history.map(r => {
    let badge = '<span class="badge badge-success">Present</span>';
    if (r.status === 'half-day') {
      badge = '<span class="badge badge-warning">Half Day</span>';
    } else if (r.isLate) {
      badge = '<span class="badge badge-warning">Late</span>';
    }

    return `
      <tr>
        <td><strong>${r.date}</strong></td>
        <td>${r.checkIn || '—'}</td>
        <td>${r.checkOut || '—'}</td>
        <td>${Storage.formatHoursMinutes(r.workMinutes || 0)}</td>
        <td>${badge}</td>
      </tr>
    `;
  }).join('');
}

function renderMyLeavesTable(employeeId) {
  const tbody = document.getElementById('myLeavesTableBody');
  if (!tbody) return;

  const myLeaves = Leave.getLeavesByEmployee(employeeId);
  if (myLeaves.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 0;">
          <div class="empty-state" id="myLeavesEmptyState">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <h4 class="empty-state-title">No leave requests</h4>
            <p class="empty-state-desc">Your submitted leave applications and approval statuses will appear here.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = myLeaves.map(l => {
    let badge = '<span class="badge badge-warning">Pending</span>';
    if (l.status === 'approved') badge = '<span class="badge badge-success">Approved</span>';
    if (l.status === 'rejected') badge = '<span class="badge badge-danger">Rejected</span>';

    return `
      <tr>
        <td>${l.leaveType}</td>
        <td>${l.startDate} to ${l.endDate}</td>
        <td><strong>${l.workingDays} d</strong></td>
        <td>${badge}</td>
        <td style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${escapeHTML(l.adminComment || '—')}</td>
      </tr>
    `;
  }).join('');
}

function setupLeaveApplicationForm(employeeId) {
  const form = document.getElementById('leaveForm');
  const fromInput = document.getElementById('leaveFromDate');
  const toInput = document.getElementById('leaveToDate');
  const calcIndicator = document.getElementById('calcWorkingDays');
  const feedback = document.getElementById('leaveFeedback');

  function updateCalcPreview() {
    if (!calcIndicator || !fromInput || !toInput) return;
    const start = fromInput.value;
    const end = toInput.value;

    if (start && end && start <= end) {
      const company = Storage.getCompanySettings();
      const count = Storage.countWorkingDays(start, end, company.workingDays || [1, 2, 3, 4, 5]);
      calcIndicator.textContent = `Calculated Working Days: ${count} days (Weekends excluded)`;
    } else {
      calcIndicator.textContent = 'Calculated Working Days: — (Weekends excluded)';
    }
  }

  if (fromInput) fromInput.addEventListener('change', updateCalcPreview);
  if (toInput) toInput.addEventListener('change', updateCalcPreview);

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (feedback) {
        feedback.style.display = 'none';
        feedback.textContent = '';
      }

      const leaveType = document.getElementById('leaveType')?.value || '';
      const startDate = fromInput?.value || '';
      const endDate = toInput?.value || '';
      const reason = document.getElementById('leaveReason')?.value || '';

      const res = Leave.applyLeave({
        employeeId,
        leaveType,
        startDate,
        endDate,
        reason
      });

      if (res.success) {
        form.reset();
        updateCalcPreview();
        updateEmployeeKPIs(employeeId);
        renderMyLeavesTable(employeeId);
        if (feedback) {
          feedback.className = 'form-feedback success';
          feedback.style.display = 'block';
          feedback.textContent = 'Leave application submitted successfully for administrator review.';
          setTimeout(() => { feedback.style.display = 'none'; }, 5000);
        }
      } else {
        if (feedback) {
          feedback.className = 'form-feedback error';
          feedback.style.display = 'block';
          feedback.textContent = res.error;
        }
      }
    });
  }
}

// ============================================================================
// 8. MONTHLY PAYSLIP (pages/payslip.html)
// ============================================================================
function initPayslipPage() {
  const user = initCommonShell(['admin', 'employee']);

  const monthSelect = document.getElementById('payslipMonth');
  const yearSelect = document.getElementById('payslipYear');
  const toolbarControls = document.querySelector('.payslip-toolbar-controls');

  let targetEmployeeId = user.id;

  // If Admin: add employee dropdown to toolbar so admin can view any employee's slip
  if (user.role === 'admin') {
    const allEmployees = Employees.getAllEmployees();

    const empSelect = document.createElement('select');
    empSelect.id = 'payslipEmployeeSelect';
    empSelect.className = 'form-select';
    empSelect.style.width = '180px';
    empSelect.setAttribute('aria-label', 'Select Employee');

    empSelect.innerHTML = allEmployees.map(e => `
      <option value="${e.id}">${escapeHTML(e.fullName)} (${e.id})</option>
    `).join('');

    if (allEmployees.length > 0) {
      targetEmployeeId = allEmployees[0].id;
    }

    if (toolbarControls && monthSelect) {
      toolbarControls.insertBefore(empSelect, monthSelect);
      empSelect.addEventListener('change', () => {
        targetEmployeeId = empSelect.value;
        refreshSlip();
      });
    }
  }

  // Populate month & year
  const now = new Date();
  if (monthSelect) {
    // Month options 0 to 11
    monthSelect.innerHTML = Payslip.MONTH_NAMES.map((name, idx) => `
      <option value="${idx}" ${idx === now.getMonth() ? 'selected' : ''}>${name}</option>
    `).join('');
    monthSelect.addEventListener('change', refreshSlip);
  }

  if (yearSelect) {
    const curYear = now.getFullYear();
    yearSelect.innerHTML = `
      <option value="${curYear}" selected>${curYear}</option>
      <option value="${curYear - 1}">${curYear - 1}</option>
    `;
    yearSelect.addEventListener('change', refreshSlip);
  }

  // Print button
  const printBtn = document.getElementById('printPayslipBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  function refreshSlip() {
    const y = parseInt(yearSelect ? yearSelect.value : now.getFullYear(), 10);
    const m = parseInt(monthSelect ? monthSelect.value : now.getMonth(), 10);

    const data = Payslip.calculatePayslip(targetEmployeeId, y, m);
    Payslip.renderPayslipDocument(data);
  }

  // Initial render
  refreshSlip();
}

// ============================================================================
// UTILITIES
// ============================================================================
function getInitials(name) {
  if (!name) return 'SA';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
