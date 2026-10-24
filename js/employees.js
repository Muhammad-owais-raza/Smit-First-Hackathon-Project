/**
 * HCM Lite — Employee Management Layer
 * Handles full Employee CRUD operations, login account generation,
 * search & filtering, form validations, and associated record integrity.
 */

const Employees = (() => {
  'use strict';

  /**
   * Retrieve all registered employees (excluding system admins).
   * @param {boolean} [includeAdmins=false]
   * @returns {Object[]}
   */
  function getAllEmployees(includeAdmins = false) {
    const users = Storage.get(Storage.KEYS.USERS, []);
    if (includeAdmins) return users;
    return users.filter(u => u.role === 'employee');
  }

  /**
   * Find an employee by unique ID.
   * @param {string} id
   * @returns {Object|null}
   */
  function getEmployeeById(id) {
    if (!id) return null;
    const users = Storage.get(Storage.KEYS.USERS, []);
    return users.find(u => u.id === id) || null;
  }

  /**
   * Create a new employee and their associated self-service portal login.
   * @param {Object} data
   * @returns {Promise<{success: boolean, error?: string, employee?: Object}>}
   */
  async function createEmployee({ fullName, email, department, jobTitle, monthlySalary, password, confirmPassword }) {
    if (!fullName || !fullName.trim()) {
      return { success: false, error: 'Full Name is required.' };
    }
    if (!email || !email.trim()) {
      return { success: false, error: 'Email address is required.' };
    }

    const emailNormalized = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNormalized)) {
      return { success: false, error: 'Please enter a valid company email address.' };
    }

    const users = Storage.get(Storage.KEYS.USERS, []);
    const emailExists = users.some(u => u.email.toLowerCase() === emailNormalized);
    if (emailExists) {
      return { success: false, error: 'An employee or administrator already exists with this email address.' };
    }

    if (!department || !department.trim()) {
      return { success: false, error: 'Department selection is required.' };
    }
    if (!jobTitle || !jobTitle.trim()) {
      return { success: false, error: 'Job Title / Designation is required.' };
    }

    const salaryNum = Number(monthlySalary);
    if (isNaN(salaryNum) || salaryNum <= 0) {
      return { success: false, error: 'Monthly Salary must be a valid positive amount greater than zero.' };
    }

    if (!password || password.length < 6) {
      return { success: false, error: 'Initial password must be at least 6 characters long.' };
    }
    if (password !== confirmPassword) {
      return { success: false, error: 'Password and Confirmation Password do not match.' };
    }

    // Generate unique sequential or random employee ID
    let newId = '';
    let counter = users.filter(u => u.role === 'employee').length + 1;
    do {
      newId = `EMP-${1000 + counter}`;
      counter++;
    } while (users.some(u => u.id === newId));

    const salt = Auth.generateSalt();
    const hash = await Auth.hashPassword(password, salt);

    const newEmployee = {
      id: newId,
      fullName: fullName.trim(),
      email: emailNormalized,
      passwordHash: hash,
      passwordSalt: salt,
      role: 'employee',
      department: department.trim(),
      jobTitle: jobTitle.trim(),
      monthlySalary: salaryNum,
      active: true,
      createdAt: new Date().toISOString()
    };

    users.push(newEmployee);
    Storage.set(Storage.KEYS.USERS, users);

    return { success: true, employee: newEmployee };
  }

  /**
   * Update an existing employee record.
   * @param {string} id
   * @param {Object} data
   * @returns {Promise<{success: boolean, error?: string, employee?: Object}>}
   */
  async function updateEmployee(id, { fullName, email, department, jobTitle, monthlySalary, status, password, confirmPassword }) {
    const users = Storage.get(Storage.KEYS.USERS, []);
    const index = users.findIndex(u => u.id === id);

    if (index === -1) {
      return { success: false, error: 'Employee record not found.' };
    }

    const current = users[index];

    if (!fullName || !fullName.trim()) {
      return { success: false, error: 'Full Name is required.' };
    }
    if (!email || !email.trim()) {
      return { success: false, error: 'Email address is required.' };
    }

    const emailNormalized = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNormalized)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    // Check duplicate email against other records
    const duplicate = users.some(u => u.id !== id && u.email.toLowerCase() === emailNormalized);
    if (duplicate) {
      return { success: false, error: 'Another account already uses this email address.' };
    }

    if (!department || !department.trim()) {
      return { success: false, error: 'Department is required.' };
    }
    if (!jobTitle || !jobTitle.trim()) {
      return { success: false, error: 'Job Title is required.' };
    }

    const salaryNum = Number(monthlySalary);
    if (isNaN(salaryNum) || salaryNum <= 0) {
      return { success: false, error: 'Monthly Salary must be a positive number.' };
    }

    // Optional password reset
    let newHash = current.passwordHash;
    let newSalt = current.passwordSalt;

    if (password && password.trim()) {
      if (password.length < 6) {
        return { success: false, error: 'New password must be at least 6 characters long.' };
      }
      if (password !== confirmPassword) {
        return { success: false, error: 'Password confirmation does not match.' };
      }
      newSalt = Auth.generateSalt();
      newHash = await Auth.hashPassword(password, newSalt);
    }

    const updated = {
      ...current,
      fullName: fullName.trim(),
      email: emailNormalized,
      department: department.trim(),
      jobTitle: jobTitle.trim(),
      monthlySalary: salaryNum,
      active: status !== undefined ? Boolean(status) : current.active,
      passwordHash: newHash,
      passwordSalt: newSalt,
      updatedAt: new Date().toISOString()
    };

    users[index] = updated;
    Storage.set(Storage.KEYS.USERS, users);

    return { success: true, employee: updated };
  }

  /**
   * Delete an employee and cleanly handle all associated records.
   * Prevents deletion of the primary administrator.
   * @param {string} id
   * @returns {{success: boolean, error?: string}}
   */
  function deleteEmployee(id) {
    const users = Storage.get(Storage.KEYS.USERS, []);
    const target = users.find(u => u.id === id);

    if (!target) {
      return { success: false, error: 'Employee not found.' };
    }

    if (target.role === 'admin') {
      return { success: false, error: 'Master Administrator account cannot be deleted.' };
    }

    // 1. Remove from users list
    const updatedUsers = users.filter(u => u.id !== id);
    Storage.set(Storage.KEYS.USERS, updatedUsers);

    // 2. Remove associated attendance records
    const attendance = Storage.get(Storage.KEYS.ATTENDANCE, []);
    const filteredAttendance = attendance.filter(a => a.employeeId !== id);
    Storage.set(Storage.KEYS.ATTENDANCE, filteredAttendance);

    // 3. Remove associated leave requests
    const leaves = Storage.get(Storage.KEYS.LEAVES, []);
    const filteredLeaves = leaves.filter(l => l.employeeId !== id);
    Storage.set(Storage.KEYS.LEAVES, filteredLeaves);

    return { success: true };
  }

  /**
   * Filter and search employees list based on criteria.
   * @param {Object[]} list
   * @param {string} search
   * @param {string} department
   * @param {string} status - 'Active' | 'Inactive' | ''
   * @returns {Object[]}
   */
  function filterEmployees(list, search = '', department = '', status = '') {
    const q = (search || '').trim().toLowerCase();

    return list.filter(emp => {
      // Search query match
      if (q) {
        const matchName = emp.fullName.toLowerCase().includes(q);
        const matchEmail = emp.email.toLowerCase().includes(q);
        const matchId = emp.id.toLowerCase().includes(q);
        const matchTitle = (emp.jobTitle || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchId && !matchTitle) {
          return false;
        }
      }

      // Department filter
      if (department && emp.department !== department) {
        return false;
      }

      // Status filter
      if (status) {
        const isActive = emp.active !== false;
        if (status === 'Active' && !isActive) return false;
        if (status === 'Inactive' && isActive) return false;
      }

      return true;
    });
  }

  return {
    getAllEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    filterEmployees
  };
})();
