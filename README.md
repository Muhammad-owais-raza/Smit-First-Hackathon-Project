# HCM Lite — Professional Human Capital Management Web Application
### Saylani Hackathon (Beginner Track) | Full Frontend + JavaScript + LocalStorage Implementation

**HCM Lite** is a modern, responsive, production-quality Human Capital Management SaaS web application built with **HTML5, CSS3, Vanilla JavaScript, and Browser LocalStorage**.

It delivers a complete, role-based HR platform for two distinct personas:
1. **Administrator:** Company setup, employee CRUD & portal account generation, attendance monitoring, leave approvals, payroll oversight, announcements, and AI-style Smart Helper queries.
2. **Employee:** Self-service dashboard, daily attendance punch-in/out, live working hour tracking, leave applications with automatic working-day calculations, personal attendance logs, official monthly salary slip printing, and privacy-restricted Smart Helper assistance.

---

## 📋 Table of Contents

- [Features Overview](#-features-overview)
- [Technologies Used](#-technologies-used)
- [Project Architecture & File Structure](#-project-architecture--file-structure)
- [How to Run the Application](#-how-to-run-the-application)
- [First-Run Setup & User Workflows](#-first-run-setup--user-workflows)
- [Attendance Business Rules & Logic](#-attendance-business-rules--logic)
- [Leave Management Rules & Quota Tracking](#-leave-management-rules--quota-tracking)
- [Payroll & Salary Calculation Formulas](#-payroll--salary-calculation-formulas)
- [Smart Helper (AI-Style Assistant)](#-smart-helper-ai-style-assistant)
- [LocalStorage Architecture & Data Models](#-localstorage-architecture--data-models)
- [Resetting Data & Testing Scenarios](#-resetting-data--testing-scenarios)
- [Security & Architecture Limitations](#-security--architecture-limitations)
- [Deployment Notes (GitHub Pages, Netlify, Vercel)](#-deployment-notes)

---

## 🌟 Features Overview

### 1. Master Authentication & Role-Based Security
- **Dynamic First-Run Onboarding:** Automatically detects empty storage and presents the First-Run Setup form to configure the company and initial master Administrator account.
- **PBKDF2 Password Hashing:** Uses the browser Web Crypto API to derive 256-bit PBKDF2 hashes with 100,000 iterations and unique 16-byte cryptographically secure salts.
- **Session Protection & Route Guards:** Protected routes (`pages/*.html`) verify authentication and enforce strict role boundaries. Unauthorized attempts automatically redirect to login or authorized dashboards.
- **Deactivated Account Handling:** Inactive employee accounts are blocked from accessing the system.

### 2. Administrator Portal (`pages/admin.html`)
- **Real-Time KPI Cards:** Displays live calculated metrics for Total Employees, Present Today, On Leave Today, and Late Arrivals. Never uses hardcoded or fabricated totals.
- **Weekly Attendance Visualizer:** Dynamic CSS bar chart visualizing Monday–Friday attendance trends (Present, Late, and Absent).
- **Department Distribution Chart:** Dynamic headcount and percentage breakdown across organizational departments.
- **Today's Attendance Logs:** Real-time log table showing check-in/out times, work durations, and status badges (Present, Late, Half Day).
- **Pending Leave Approvals Card:** Real-time queue linking directly to decision workflows.
- **Announcements Broadcast:** Publish organization notices with author and timestamp.
- **Smart Helper:** Rule-based query assistant answering natural language questions using live LocalStorage data.

### 3. Employee Management (`pages/employees.html`)
- **Full Employee CRUD:** Create, read, edit, and delete employee records.
- **Automated Portal Login Creation:** Setting up an employee automatically provisions their login credentials.
- **Live Search & Multi-Filters:** Real-time search by name, email, employee ID, or designation; filter by department and active/inactive status.
- **Integrity Enforcement:** Validates email format and uniqueness; requires monthly salary > 0; preserves original employee IDs on edit; protects the primary administrator from accidental deletion; cascades deletion cleanly to associated logs.

### 4. Leave Management (`pages/leaves.html`)
- **Summary Counters:** Live counts of Pending, Approved, and Rejected requests.
- **Filters:** Filter requests by status, leave category, and date.
- **Review Dialog Modal:** Review applicant details, date span, working days count, employee reason, and submit approval or rejection with admin notes.
- **State Lock:** Prevents re-reviewing already processed leave requests.
- **Quota Feedback:** Approvals immediately deduct working days from the employee's annual quota; rejections do not penalize balances.

### 5. Company Settings (`pages/settings.html`)
- **Company Profile:** Edit company name, support email, office address, and contact number.
- **Attendance & Workday Rules:** Set Office Start Time (e.g. `09:00`), Grace Period in minutes (e.g. `15`), Expected Shift Hours (e.g. `8`), and active Working Days of the week (Mon–Sun checklist).
- **Leave Quota & Policy Statement:** Set yearly paid leave quota (default `20` days) and employee policy statement.
- **Historical Stability:** Updating settings influences future calculations without rewriting historical records.

### 6. Employee Self-Service Dashboard (`pages/employee.html`)
- **Time Tracker Card:** One-click **Check In** and **Check Out** punch buttons with live timestamps and duration counter.
- **Personal Metrics:** Live counters for Present Days, Absent Days, Late Arrivals, and Remaining Leave Quota.
- **Interactive Leave Application:** Select leave type, choose date ranges with real-time working day calculation (automatically skipping configured weekends/off-days), validate quota, and submit for review.
- **Personal Logs:** Private tables showing historical attendance logs and leave request statuses with administrator review notes.
- **Private Smart Helper:** Answers personal attendance, late status, weekly hours, and leave balance questions without exposing company-wide or peer records.

### 7. Monthly Payslip (`pages/payslip.html`)
- **Document-Quality Salary Slip:** Formal corporate slip with company header, employee details, attendance summary, earnings vs. deductions breakdown, and signature boxes.
- **Administrator Multi-Employee Selector:** Administrators can switch between any employee to audit their slip; employees are locked to their own document.
- **Exact Hackathon Payroll Formulas:** Computes daily rate, absence deductions, and half-day deductions based on configured working weekdays.
- **Dedicated Print Styles (`@media print`):** Strips navigation, toolbars, and buttons for clean A4 printing or PDF export.

---

## 💻 Technologies Used

- **HTML5:** Semantic layout elements (`<header>`, `<nav>`, `<aside>`, `<main>`, `<section>`, `<article>`, `<table>`, `<form>`).
- **CSS3:** Custom properties (design tokens), CSS Grid, Flexbox, transitions, modals, and print media queries.
- **Vanilla JavaScript (ES6+):** Modular IIFE patterns, `async/await`, Web Crypto API (`SubtleCrypto`), DOM event delegation.
- **Browser LocalStorage:** Client-side document database persisting structured JSON records across page reloads.

---

## 📁 Project Architecture & File Structure

```text
hcm-lite/
├── index.html               # Authentication & First-Run Company Setup
├── pages/
│   ├── admin.html           # Administrator Master Dashboard
│   ├── employees.html       # Employee Directory & CRUD Management
│   ├── leaves.html          # Leave Application Queue & Approvals
│   ├── settings.html        # Company Profile, Work Schedules & Policies
│   ├── employee.html        # Employee Self-Service Dashboard
│   └── payslip.html         # Monthly Salary Slip & Print Layout
├── css/
│   └── style.css            # Master Design System & Responsive Styles
├── js/
│   ├── storage.js           # LocalStorage CRUD, Date/Time/Currency Helpers
│   ├── auth.js              # PBKDF2 Password Hashing, Session & Route Guards
│   ├── employees.js         # Employee Business Logic, Validation & Filtering
│   ├── attendance.js        # Punch Rules, Grace Period & Work Hour Logic
│   ├── leave.js             # Working-Day Calculations, Overlap & Quota Logic
│   ├── payslip.js           # Hackathon Salary & Deduction Computation
│   ├── helper.js            # Rule-Based Intelligent Smart Helper Assistant
│   ├── announcements.js     # Company Notices & Broadcast Logic
│   └── app.js               # Page Router & DOM UI Binding Orchestrator
└── README.md                # Master Application Documentation
```

---

## 🚀 How to Run the Application

The application requires no compiler, package manager (`npm`), or database server. Because modern browser security policies restrict Web Crypto and certain storage features under `file:///`, run it using a local HTTP server:

### Option 1: VS Code Live Server (Recommended)
1. Open the project folder in **Visual Studio Code**.
2. Install the **Live Server** extension (by Ritwick Dey).
3. Right-click `index.html` and choose **"Open with Live Server"**.
4. The application will open in your default browser at `http://127.0.0.1:5500/index.html`.

### Option 2: Python HTTP Server
Open your terminal or PowerShell in the project directory and run:
```bash
# Python 3
python -m http.server 8000
```
Open `http://localhost:8000` in your web browser.

### Option 3: Node `npx serve` or `http-server`
```bash
npx serve .
# or
npx http-server -p 8000
```

---

## 👤 First-Run Setup & User Workflows

### 1. First-Run Setup
1. Launch `index.html`. The app automatically detects that no company is configured and opens the **First-Run Setup** tab.
2. Enter:
   - **Company Name:** e.g., `Acme Innovations`
   - **Admin Full Name:** e.g., `Sarah Jenkins`
   - **Admin Work Email:** e.g., `admin@acme.com`
   - **Password & Confirm Password:** e.g., `admin123` (minimum 6 characters)
3. Click **"Create Company & Admin Account"**.
4. You will be logged in and redirected directly to the **Admin Dashboard** (`pages/admin.html`).

### 2. Onboarding an Employee (Admin Flow)
1. Go to **Employees** (`pages/employees.html`).
2. Click **"Add Employee"**.
3. Enter the employee's details:
   - **Full Name:** e.g., `John Doe`
   - **Company Email:** e.g., `john@acme.com`
   - **Department:** `Engineering`
   - **Job Title:** `Senior Software Engineer`
   - **Monthly Salary (PKR):** `150000`
   - **Password:** `john123`
4. Click **"Save Employee"**. The new employee account (e.g. ID `EMP-1001`) is immediately created and active.

### 3. Employee Self-Service Flow
1. Click **Sign Out** in the sidebar footer.
2. On `index.html`, select the **Sign In** tab.
3. Enter `john@acme.com` and `john123`, then click **"Sign In to Workspace"**.
4. The employee is redirected to their personal **Employee Dashboard** (`pages/employee.html`).
5. Click **"Check In Now"** to record daily attendance.
6. Submit a leave request via the **Apply for Leave** form.
7. Open **My Payslip** (`pages/payslip.html`) to view the calculated salary slip and click **"Print / Save PDF"**.

---

## ⏰ Attendance Business Rules & Logic

- **One Check-In per Day:** An employee can check in at most once per local calendar date (`YYYY-MM-DD`). Subsequent attempts are blocked.
- **Grace Period Calculation:**
  - Office Start Time is configured in Company Settings (default: `09:00 AM`).
  - Grace Period is configured in minutes (default: `15 minutes`).
  - Late Arrival Threshold = Start Time + Grace Period (e.g., `09:15 AM`).
  - Check-in $\le$ 09:15 is marked as **Present (On Time)**.
  - Check-in $>$ 09:15 is marked as **Late**.
- **Check-Out Validation:**
  - Check-out is permitted only after an active check-in on the same day.
  - Check-out time must be later than check-in time.
  - Total work duration is calculated in minutes: $\text{Duration} = \text{CheckOut} - \text{CheckIn}$.
- **Half-Day Rule:**
  - If completed shift duration is strictly less than **5 hours (300 minutes)**, attendance is marked as **Half Day**.
  - The `isLate` flag is preserved independently so an employee can be both late and a half-day worker.
- **Absence Counting:**
  - Absence is calculated on elapsed working weekdays up to the current date.
  - Configured company non-working days (e.g., Saturday and Sunday) are never counted as absences.
  - Dates prior to the employee's account creation date are excluded.
  - Approved leaves covering working days are excluded so employees are not penalized twice.

---

## 🌴 Leave Management Rules & Quota Tracking

- **Working-Day Counting:** Date ranges count only configured company working weekdays. Weekends and non-working days are skipped automatically.
- **No Zero-Day Requests:** If an employee selects dates falling solely on weekends/off-days, the application rejects the request.
- **Overlap Prevention:** Employees cannot apply for leave spanning dates that overlap with an existing `pending` or `approved` leave.
- **Annual Quota Enforcement:**
  - Standard yearly quota is configured in Company Settings (default: `20` days).
  - Remaining balance formula:
    $$\text{Remaining Balance} = \text{Annual Quota} - \text{Approved Working Days in Calendar Year}$$
  - Requests exceeding the remaining balance are rejected (unless applying for Unpaid leave).
  - Cross-calendar-year requests are disallowed to maintain strict annual quota accounting.
- **Approval Workflow:**
  - Pending and rejected requests do **not** reduce an employee's approved leave balance.
  - Only Administrator approval deducts working days from the balance.
  - Quota and overlaps are re-verified at the exact moment of Admin approval to prevent race conditions.

---

## 💵 Payroll & Salary Calculation Formulas

The payroll module (`js/payslip.js`) implements the formulas specified in the Saylani Hackathon PDF:

### 1. Daily Salary Rate
$$\text{Daily Salary} = \frac{\text{Monthly Basic Salary}}{\text{Total Working Days in Month}}$$
*(If working days in the month equals 0, daily salary defaults safely to 0 to prevent division by zero).*

### 2. Attendance Deductions
$$\text{Absence Deduction} = \text{Daily Salary} \times \text{Absent Days}$$
$$\text{Half-Day Deduction} = \text{Daily Salary} \times (0.5 \times \text{Half-Day Count})$$
$$\text{Total Deductions} = \text{Absence Deduction} + \text{Half-Day Deduction}$$

### 3. Net Payable Salary
$$\text{Net Payable Salary} = \max(0, \text{Monthly Basic Salary} - \text{Total Deductions})$$

### Important Payroll Notes:
- Working days in the month are calculated using the Administrator's configured working weekdays for that specific calendar month.
- Approved leaves are excluded from absent day counts so employees on authorized leave receive their full compensation.
- Currency is rounded and displayed to two decimal places (`PKR 150,000.00`).
- Net amount in words is generated dynamically (e.g., *"One Lakh Fifty Thousand Rupees Only"*).

---

## 🤖 Smart Helper (AI-Style Assistant)

The Smart Helper (`js/helper.js`) is an intelligent rule-based natural language assistant that queries live LocalStorage data.

### Administrator Queries Supported:
- *"How many employees do we have?"* $\rightarrow$ Returns active and total workforce counts across departments.
- *"Who is on leave today?"* $\rightarrow$ Lists names and departments of employees on approved leave today.
- *"Who was late today?"* $\rightarrow$ Lists employees who arrived after the grace threshold with check-in timestamps.
- *"How many employees are present?"* $\rightarrow$ Reports current turnout ratio.
- *"How many leave requests are pending?"* $\rightarrow$ Reports total applications awaiting administrator review.

### Employee Queries Supported:
- *"How many leaves do I have left?"* $\rightarrow$ Returns personal remaining quota and days used.
- *"Was I late today?"* $\rightarrow$ Checks personal check-in against the office start time and grace threshold.
- *"How many hours did I work this week?"* $\rightarrow$ Sums logged work duration across the current week.
- *"What is my attendance status today?"* $\rightarrow$ Details today's check-in/out timestamps and status.

### Privacy Enforcement:
If an employee asks about other employees or company-wide payroll, the Smart Helper replies:
> *"For privacy and compliance reasons, your Smart Helper is strictly limited to your own personal attendance, leave, and payroll records."*

---

## 💾 LocalStorage Architecture & Data Models

All application state is stored under six primary keys:

### 1. `hcm_company`
```json
{
  "companyName": "Acme Innovations",
  "companyEmail": "hr@acme.com",
  "companyAddress": "45 Innovation Way, Suite 300, Karachi",
  "companyPhone": "+92 21 34567890",
  "officeStartTime": "09:00",
  "gracePeriod": 15,
  "dailyWorkHours": 8,
  "workingDays": [1, 2, 3, 4, 5],
  "yearlyLeaveQuota": 20,
  "leavePolicyDescription": "Employees are entitled to 20 paid leave days annually..."
}
```

### 2. `hcm_users`
```json
[
  {
    "id": "ADM-1001",
    "fullName": "Sarah Jenkins",
    "email": "admin@acme.com",
    "passwordHash": "a3f5b7...",
    "passwordSalt": "8e1b4c...",
    "role": "admin",
    "department": "Executive Management",
    "jobTitle": "System Administrator",
    "monthlySalary": 0,
    "active": true,
    "createdAt": "2026-10-24T06:00:00.000Z"
  },
  {
    "id": "EMP-1001",
    "fullName": "John Doe",
    "email": "john@acme.com",
    "passwordHash": "c2d9e1...",
    "passwordSalt": "4f9a0b...",
    "role": "employee",
    "department": "Engineering",
    "jobTitle": "Senior Software Engineer",
    "monthlySalary": 150000,
    "active": true,
    "createdAt": "2026-10-24T06:15:00.000Z"
  }
]
```

### 3. `hcm_attendance`
```json
[
  {
    "id": "ATT-3891",
    "employeeId": "EMP-1001",
    "date": "2026-10-24",
    "checkIn": "09:08",
    "checkOut": "17:15",
    "workMinutes": 487,
    "status": "present",
    "isLate": false
  }
]
```

### 4. `hcm_leaves`
```json
[
  {
    "id": "LV-6124",
    "employeeId": "EMP-1001",
    "leaveType": "Casual",
    "startDate": "2026-10-27",
    "endDate": "2026-10-28",
    "workingDays": 2,
    "reason": "Personal family commitment",
    "status": "approved",
    "adminComment": "Approved. Ensure task handover.",
    "createdAt": "2026-10-24T06:20:00.000Z",
    "reviewedAt": "2026-10-24T06:25:00.000Z"
  }
]
```

### 5. `hcm_session`
```json
{
  "userId": "EMP-1001",
  "loggedInAt": "2026-10-24T06:30:00.000Z"
}
```

### 6. `hcm_announcements`
```json
[
  {
    "id": "ANN-5012",
    "title": "Quarterly Town Hall",
    "message": "All staff are invited to our quarterly company town hall this Friday at 3:00 PM.",
    "authorId": "ADM-1001",
    "authorName": "Sarah Jenkins",
    "createdAt": "2026-10-24T06:10:00.000Z"
  }
]
```

---

## 🔄 Resetting Data & Testing Scenarios

To reset the application to its clean First-Run state:
1. Open your browser Developer Tools (`F12` or `Ctrl + Shift + I`).
2. Navigate to the **Console** tab.
3. Run:
   ```javascript
   localStorage.clear();
   location.reload();
   ```
4. You will immediately be presented with the **First-Run Company Setup** screen.

---

## 🔒 Security & Architecture Limitations

While HCM Lite adheres to modern software design patterns, this is a **client-side only application** built for educational and demonstration purposes:

1. **Client-Side Storage Sandbox:** All data lives exclusively inside the user's browser `localStorage` on that specific origin. Data is not synchronized across different devices or separate browser profiles.
2. **Client-Side Password Hashing:** Although PBKDF2 with unique salts is used to avoid plaintext storage, client-side hashing cannot defend against a user who inspects or alters their own browser storage.
3. **No True Server-Side Validation:** A production enterprise HR application requires a hardened backend server (Node.js, Go, Python, etc.), an ACID-compliant database (PostgreSQL), server-side session management (HTTP-only secure cookies or JWT), and real role-based access control (RBAC).

---

## 🌐 Deployment Notes

HCM Lite is 100% static and can be deployed instantly to any static web hosting platform:

- **GitHub Pages:** Push to a repository, go to `Settings` $\rightarrow$ `Pages`, and select the root or `main` branch.
- **Netlify:** Drag and drop the project folder directly into Netlify Drop.
- **Vercel:** Run `vercel` from the project directory.

*Note: Since LocalStorage is origin-isolated, data created on `localhost` will not transfer to your deployed URL. You will complete first-run setup once on the deployed domain.*

---

## 🏆 Saylani Hackathon Compliance Checklist

- [x] All 7 HTML pages present and fully functional.
- [x] Consistent premium blue-and-white SaaS UI theme.
- [x] Vanilla JavaScript implementation with zero external JS frameworks.
- [x] Web Crypto PBKDF2 password hashing with unique salts.
- [x] Zero hardcoded or fabricated employee records.
- [x] Grace period and late check-in detection rules enforced.
- [x] Half-day calculation under 5 hours enforced.
- [x] Leave overlap prevention and calendar working-day counting enforced.
- [x] Exact hackathon salary and deduction formulas implemented.
- [x] Dedicated `@media print` CSS for monthly salary slips.
- [x] Working rule-based Smart Helper with role privacy guards.
- [x] Complete LocalStorage persistence across page reloads.
