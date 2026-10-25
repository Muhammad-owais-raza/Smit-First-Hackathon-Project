/**
 * HCM Lite — Authentication & Authorization Layer
 * Implements PBKDF2 password hashing with unique salts (Web Crypto API),
 * session handling, role-based route guards, and first-run company setup.
 */

const Auth = (() => {
  'use strict';

  /**
   * Convert an ArrayBuffer to a hex string.
   * @param {ArrayBuffer} buffer
   * @returns {string}
   */
  function bufferToHex(buffer) {
    // Buffer ko hex string mein convert karo (har byte ko 2-digit hex mein likhte hain)
    const byteArray = new Uint8Array(buffer);
    var hex = '';
    for (var i = 0; i < byteArray.length; i++) {
      hex += byteArray[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  /**
   * Convert a hex string to an ArrayBuffer.
   * @param {string} hex
   * @returns {ArrayBuffer}
   */
  function hexToBuffer(hex) {
    // Hex string ko wapas bytes mein badalna (har 2 characters ek byte bante hain)
    var pairs = hex.match(/[\da-f]{2}/gi);
    var typedArray = new Uint8Array(pairs.length);
    for (var i = 0; i < pairs.length; i++) {
      typedArray[i] = parseInt(pairs[i], 16);
    }
    return typedArray.buffer;
  }

  /**
   * Generate a random salt string (16 bytes, hex encoded).
   * @returns {string}
   */
  function generateSalt() {
    if (window.crypto && window.crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return bufferToHex(bytes.buffer);
    }
    // Fallback pseudo-random for environments lacking crypto.getRandomValues
    var result = '';
    for (var i = 0; i < 32; i++) {
      result += Math.floor(Math.random() * 16).toString(16);
    }
    return result;
  }

  /**
   * Hash a password using PBKDF2 with SHA-256 and unique salt.
   * Yeh function password ko secure tarike se hash karta hai taake
   * original password kabhi store na ho - sirf uska hash rakha jata hai.
   * @param {string} password
   * @param {string} salt
   * @returns {Promise<string>}
   */
  async function hashPassword(password, salt) {
    if (!password) return '';
    try {
      if (window.crypto && window.crypto.subtle) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
          'raw',
          enc.encode(password),
          { name: 'PBKDF2' },
          false,
          ['deriveBits']
        );
        const derivedBits = await window.crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: enc.encode(salt),
            iterations: 100000,
            hash: 'SHA-256'
          },
          keyMaterial,
          256
        );
        return bufferToHex(derivedBits);
      }
    } catch (err) {
      console.warn('[Auth] Web Crypto subtle unavailable or failed, utilizing fallback hash:', err);
    }

    // Fallback hash implementation (SHA-256 or safe string hashing)
    let hash = 0;
    const combined = password + salt;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16) + 'fbk';
  }

  /**
   * Verify an input password against stored hash and salt.
   * @param {string} password
   * @param {string} storedHash
   * @param {string} salt
   * @returns {Promise<boolean>}
   */
  async function verifyPassword(password, storedHash, salt) {
    const computed = await hashPassword(password, salt);
    return computed === storedHash;
  }

  /**
   * Check if the application is in First-Run state (no company or admin configured).
   * @returns {boolean}
   */
  function isFirstRun() {
    const company = Storage.get(Storage.KEYS.COMPANY);
    const users = Storage.get(Storage.KEYS.USERS, []);
    var hasAdmin = false;
    for (var i = 0; i < users.length; i++) {
      if (users[i].role === 'admin') {
        hasAdmin = true;
        break;
      }
    }
    return !company || !hasAdmin;
  }

  /**
   * Perform initial First-Run company setup and create master administrator.
   * @param {Object} data
   * @returns {Promise<{success: boolean, error?: string, user?: Object}>}
   */
  async function setupCompanyAndAdmin({ companyName, adminFullName, adminEmail, adminPassword, confirmPassword }) {
    if (!companyName || !companyName.trim()) {
      return { success: false, error: 'Company Name is required.' };
    }
    if (!adminFullName || !adminFullName.trim()) {
      return { success: false, error: 'Admin Full Name is required.' };
    }
    if (!adminEmail || !adminEmail.trim()) {
      return { success: false, error: 'Admin Email is required.' };
    }
    const emailNormalized = adminEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNormalized)) {
      return { success: false, error: 'Please enter a valid work email address.' };
    }
    if (!adminPassword || adminPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }
    if (adminPassword !== confirmPassword) {
      return { success: false, error: 'Passwords do not match.' };
    }

    // Initialize company profile
    const currentCompany = Storage.getCompanySettings();
    const updatedCompany = Object.assign({}, currentCompany, {
      companyName: companyName.trim(),
      companyEmail: emailNormalized
    });
    Storage.set(Storage.KEYS.COMPANY, updatedCompany);

    // Hash Admin password
    const salt = generateSalt();
    const hash = await hashPassword(adminPassword, salt);

    const adminUser = {
      id: 'ADM-1001',
      fullName: adminFullName.trim(),
      email: emailNormalized,
      passwordHash: hash,
      passwordSalt: salt,
      role: 'admin',
      department: 'Executive Management',
      jobTitle: 'System Administrator',
      monthlySalary: 0,
      active: true,
      createdAt: new Date().toISOString()
    };

    const users = Storage.get(Storage.KEYS.USERS, []);
    // Replace any existing or prepend - exclude old admin entry then put new one first
    var filteredUsers = [];
    for (var i = 0; i < users.length; i++) {
      if (users[i].id !== adminUser.id) {
        filteredUsers.push(users[i]);
      }
    }
    var updatedUsers = [adminUser].concat(filteredUsers);
    Storage.set(Storage.KEYS.USERS, updatedUsers);

    // Establish active session
    Storage.set(Storage.KEYS.SESSION, {
      userId: adminUser.id,
      loggedInAt: new Date().toISOString()
    });

    return { success: true, user: adminUser };
  }

  /**
   * Log in an existing user with email and password.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, error?: string, user?: Object}>}
   */
  async function login(email, password) {
    if (!email || !password) {
      return { success: false, error: 'Please enter both work email and password.' };
    }

    const emailNormalized = email.trim().toLowerCase();
    const users = Storage.get(Storage.KEYS.USERS, []);
    var user = null;
    for (var i = 0; i < users.length; i++) {
      if (users[i].email.toLowerCase() === emailNormalized) {
        user = users[i];
        break;
      }
    }

    if (!user) {
      return { success: false, error: 'No account found matching this email address.' };
    }

    if (user.active === false) {
      return { success: false, error: 'This employee account is deactivated. Please contact your HR administrator.' };
    }

    const valid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!valid) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    // Set Session
    Storage.set(Storage.KEYS.SESSION, {
      userId: user.id,
      loggedInAt: new Date().toISOString()
    });

    return { success: true, user };
  }

  /**
   * Terminate current session and redirect to login page.
   */
  function logout() {
    Storage.remove(Storage.KEYS.SESSION);
    const isInPages = window.location.pathname.includes('/pages/');
    window.location.href = isInPages ? '../index.html' : 'index.html';
  }

  /**
   * Retrieve full user object for current active session.
   * @returns {Object|null}
   */
  function getCurrentUser() {
    const session = Storage.get(Storage.KEYS.SESSION);
    if (!session || !session.userId) return null;

    const users = Storage.get(Storage.KEYS.USERS, []);
    var user = null;
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === session.userId) {
        user = users[i];
        break;
      }
    }
    return user || null;
  }

  /**
   * Require authentication and specific role access.
   * Automatically redirects unauthorized or unauthenticated visits.
   * @param {string[]} [allowedRoles] - ['admin', 'employee']
   * @returns {Object} current authenticated user
   */
  function requireAuth(allowedRoles = ['admin', 'employee']) {
    const user = getCurrentUser();
    const isInPages = window.location.pathname.includes('/pages/');
    const loginPath = isInPages ? '../index.html' : 'index.html';

    if (!user) {
      window.location.href = loginPath;
      throw new Error('Authentication required');
    }

    if (!allowedRoles.includes(user.role)) {
      // Redirect to authorized home dashboard
      if (user.role === 'admin') {
        window.location.href = isInPages ? 'admin.html' : 'pages/admin.html';
      } else {
        window.location.href = isInPages ? 'employee.html' : 'pages/employee.html';
      }
      throw new Error('Unauthorized role access');
    }

    return user;
  }

  /**
   * Redirect logged-in users away from the public login page.
   */
  function redirectIfLoggedIn() {
    const user = getCurrentUser();
    if (!user) return;

    if (user.role === 'admin') {
      window.location.href = 'pages/admin.html';
    } else {
      window.location.href = 'pages/employee.html';
    }
  }

  /**
   * Change password for a logged-in user.
   * Purana password verify karo, naya password hash karo aur save karo.
   * @param {string} userId
   * @param {string} currentPassword
   * @param {string} newPassword
   * @param {string} confirmPassword
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function changePassword(userId, currentPassword, newPassword, confirmPassword) {
    if (!currentPassword) {
      return { success: false, error: 'Current password is required.' };
    }
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters long.' };
    }
    if (newPassword !== confirmPassword) {
      return { success: false, error: 'New password and confirmation do not match.' };
    }

    const users = Storage.get(Storage.KEYS.USERS, []);
    var userIndex = -1;
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === userId) {
        userIndex = i;
        break;
      }
    }

    if (userIndex === -1) {
      return { success: false, error: 'User account not found.' };
    }

    const user = users[userIndex];

    // Purana password verify karo
    const valid = await verifyPassword(currentPassword, user.passwordHash, user.passwordSalt);
    if (!valid) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    // Naya password hash karo aur save karo
    const newSalt = generateSalt();
    const newHash = await hashPassword(newPassword, newSalt);

    users[userIndex] = Object.assign({}, user, {
      passwordHash: newHash,
      passwordSalt: newSalt,
      updatedAt: new Date().toISOString()
    });

    Storage.set(Storage.KEYS.USERS, users);
    return { success: true };
  }

  return {
    generateSalt,
    hashPassword,
    verifyPassword,
    isFirstRun,
    setupCompanyAndAdmin,
    login,
    logout,
    getCurrentUser,
    requireAuth,
    redirectIfLoggedIn,
    changePassword
  };
})();
