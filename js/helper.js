/**
 * HCM Lite — Smart Helper AI Assistant Layer
 * Rule-based intelligent assistant querying live LocalStorage data
 * with strict role-based data privacy enforcement.
 */

const SmartHelper = (() => {
  'use strict';

  /**
   * Process an Admin query against live company data.
   * @param {string} query
   * @returns {string}
   */
  function processAdminQuery(query) {
    const q = (query || '').toLowerCase().trim();

    // 1. Employee Count
    if (q.includes('how many employee') || q.includes('total employee') || q.includes('employee count') || q.includes('headcount')) {
      const staff = Employees.getAllEmployees();
      const active = staff.filter(e => e.active !== false).length;
      const depts = new Set(staff.map(e => e.department)).size;
      return `Our organization currently has ${staff.length} registered employees (${active} active) distributed across ${depts} departments.`;
    }

    // 2. Who is on leave today
    if (q.includes('who is on leave') || q.includes('on leave today') || q.includes('leave today')) {
      const today = Storage.getTodayLocalDate();
      const staff = Employees.getAllEmployees();
      const onLeave = staff.filter(e => Leave.isEmployeeOnLeaveOnDate(e.id, today));

      if (onLeave.length === 0) {
        return 'No employees are on approved leave today. The entire workforce is scheduled for duty.';
      }
      const names = onLeave.map(e => `${e.fullName} (${e.department})`).join(', ');
      return `Today, ${onLeave.length} employee(s) are on approved leave: ${names}.`;
    }

    // 3. Who was late today
    if (q.includes('who was late') || q.includes('late today') || q.includes('late arrival')) {
      const todayRecords = Attendance.getCompanyAttendanceToday();
      const lateRecords = todayRecords.filter(r => r.isLate);

      if (lateRecords.length === 0) {
        return 'No late arrivals recorded today! All staff checked in within the allowed grace period.';
      }

      const details = lateRecords.map(r => {
        const emp = Employees.getEmployeeById(r.employeeId);
        const name = emp ? emp.fullName : r.employeeId;
        return `${name} (checked in at ${r.checkIn})`;
      }).join(', ');

      return `Today, ${lateRecords.length} employee(s) arrived after the grace period threshold: ${details}.`;
    }

    // 4. Present today
    if (q.includes('present') || q.includes('turnout')) {
      const todayRecords = Attendance.getCompanyAttendanceToday();
      const staff = Employees.getAllEmployees().filter(e => e.active !== false);
      return `Currently, ${todayRecords.length} out of ${staff.length} active employees have checked in today.`;
    }

    // 5. Pending leaves
    if (q.includes('pending') || q.includes('leave request') || q.includes('leave queue')) {
      const pending = Leave.getAllLeaves({ status: 'pending' });
      if (pending.length === 0) {
        return 'There are currently no pending leave requests awaiting your review.';
      }
      return `You have ${pending.length} pending leave application(s) awaiting administrative review. You can approve or reject them on the Leave Management page.`;
    }

    // Fallback for Admin
    return `I can help you analyze workplace metrics. Try asking me:
• "How many employees do we have?"
• "Who is on leave today?"
• "Who was late today?"
• "How many employees are present?"
• "How many leave requests are pending?"`;
  }

  /**
   * Process an Employee query against their own personal records.
   * @param {string} query
   * @param {Object} currentUser
   * @returns {string}
   */
  function processEmployeeQuery(query, currentUser) {
    const q = (query || '').toLowerCase().trim();

    // Privacy guard: block inquiries into other employees or company-wide payroll
    if (q.includes('salary of') || q.includes('who earns') || q.includes('other employee') || q.includes('all employee')) {
      return 'For privacy and compliance reasons, your Smart Helper is strictly limited to your own personal attendance, leave, and payroll records.';
    }

    // 1. Remaining leaves
    if (q.includes('leave') && (q.includes('left') || q.includes('remaining') || q.includes('balance') || q.includes('quota') || q.includes('how many'))) {
      const balance = Leave.getRemainingLeaveBalance(currentUser.id);
      return `You have ${balance.remaining} paid leave days remaining out of your annual quota of ${balance.quota} days (${balance.used} days used this year).`;
    }

    // 2. Was I late today
    if (q.includes('late')) {
      const record = Attendance.getTodayAttendance(currentUser.id);
      if (!record) {
        return "You haven't checked in yet today, so no arrival status has been recorded.";
      }
      if (record.isLate) {
        return `Yes, you checked in at ${record.checkIn}, which was after the office start time and grace period threshold.`;
      }
      return `No, you were on time! You checked in at ${record.checkIn}, within the allowable grace period.`;
    }

    // 3. Work hours this week
    if (q.includes('hour') || q.includes('duration') || q.includes('worked')) {
      const history = Attendance.getEmployeeAttendanceHistory(currentUser.id);
      // Filter current week
      const now = new Date();
      const currentDay = now.getDay();
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const mondayStr = Storage.formatLocalDate(monday);
      const todayStr = Storage.getTodayLocalDate();

      const weekRecords = history.filter(r => r.date >= mondayStr && r.date <= todayStr);
      const totalMinutes = weekRecords.reduce((sum, r) => sum + (r.workMinutes || 0), 0);

      return `This week (${mondayStr} to today), you have logged ${Storage.formatHoursMinutes(totalMinutes)} across ${weekRecords.length} recorded shift(s).`;
    }

    // 4. Attendance status today
    if (q.includes('status') || q.includes('check in') || q.includes('checked in') || q.includes('attendance')) {
      const record = Attendance.getTodayAttendance(currentUser.id);
      if (!record) {
        return "You have not checked in today. Please click the 'Check In Now' button on your dashboard to start your workday.";
      }
      if (record.checkOut) {
        return `You completed your workday: Checked in at ${record.checkIn} and checked out at ${record.checkOut} (Total: ${Storage.formatHoursMinutes(record.workMinutes)}). Status: ${record.status}.`;
      }
      return `You are currently checked in since ${record.checkIn}. Don't forget to check out when completing your shift!`;
    }

    // Fallback for Employee
    return `Hello ${currentUser.fullName.split(' ')[0]}! I can assist you with your personal work records. You can ask:
• "How many leaves do I have left?"
• "Was I late today?"
• "How many hours did I work this week?"
• "What is my attendance status today?"`;
  }

  /**
   * Main responder dispatching based on user role.
   * @param {string} query
   * @param {Object} currentUser
   * @returns {string}
   */
  function answerQuery(query, currentUser) {
    if (!currentUser) return 'Authentication required to process requests.';
    if (currentUser.role === 'admin') {
      return processAdminQuery(query);
    }
    return processEmployeeQuery(query, currentUser);
  }

  /**
   * Mount chat interface listeners to form, input, and suggestion chips.
   * @param {Object} config
   */
  function setupChatUI({ formId, inputId, sendBtnId, containerId, chipsSelector, currentUser }) {
    const form = document.getElementById(formId);
    const input = document.getElementById(inputId);
    const sendBtn = document.getElementById(sendBtnId);
    const container = document.getElementById(containerId);

    if (!input || !container) return;

    function handleSend() {
      const text = input.value.trim();
      if (!text) return;

      // 1. Append User Bubble
      const userBubble = document.createElement('div');
      userBubble.className = 'chat-bubble-agent';
      userBubble.style.alignSelf = 'flex-end';
      userBubble.style.backgroundColor = 'var(--color-primary-light)';
      userBubble.style.borderColor = 'var(--color-primary-soft)';
      userBubble.style.borderRadius = 'var(--radius-lg) var(--radius-lg) var(--radius-xs) var(--radius-lg)';
      userBubble.innerHTML = `<strong>You:</strong> ${escapeHTML(text)}`;
      container.appendChild(userBubble);

      input.value = '';

      // 2. Compute response
      const answer = answerQuery(text, currentUser);

      // 3. Append Assistant Bubble
      const botBubble = document.createElement('div');
      botBubble.className = 'chat-bubble-agent';
      botBubble.innerHTML = `<strong>Assistant:</strong> ${escapeHTML(answer).replace(/\n/g, '<br>')}`;
      container.appendChild(botBubble);

      // Scroll to bottom
      container.scrollTop = container.scrollHeight;
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSend();
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleSend();
      });
    }

    // Attach click handlers to suggestion chips
    if (chipsSelector) {
      document.querySelectorAll(chipsSelector).forEach(chip => {
        chip.addEventListener('click', () => {
          input.value = chip.textContent.trim();
          handleSend();
        });
      });
    }
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    answerQuery,
    setupChatUI
  };
})();
