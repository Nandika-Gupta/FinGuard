# Application Flows & Navigation Model: FinGuard

## 1. Entry Points
- **Direct Landing Page (`/`):** The introductory dashboard displaying beautiful hero components, secure system architecture, and simulation presets.
- **Login/Signup View (`/login`):** Combined secure credentials gateway supporting authentication, node selection, and immediate initial funding configuration.
- **Admin Setup:** Admins can select standard credentials directly from simulator shortcuts to audit features rapidly.
- **Session Restoration:** Automatically checks local storage for simulated active JWT tokens and loads historical configurations gracefully.

---

## 2. Core User Flows

### A. Registration Flow
- **Happy Path:** Enters fresh username, email, password, and selects role (User/Operator/Admin). Clicks Register. Systems create simulated DB record + funding wallet -> routes to panel.
- **Error States:** Missing inputs trigger validated inline form errors. Duplicate username triggers "ERROR_USER_EXISTS".
- **Edge Cases:** Single character keywords are forbidden; passwords must meet 6+ character minimums.
- **Exit Points:** Automatic navigation to standard dashboard upon registry completion.

### B. Secure Login Flow
- **Happy Path:** Valid inputs generate simulated JWT, start logging network streams, and redirect into active telemetry.
- **Error States:** Bad password returns "AUTHENTICATION_FAILED".
- **Edge Cases:** 3 consecutive failures lock credentials block for 30 seconds.
- **Exit Points:** Landing inside FinGuard main hub or clearing lockout states.

### C. Wallet Dashboard Flow
- **Happy Path:** Visualizes current balance, live graph, and ledger logs.
- **Error States:** Zero balance returns safe warning state but does not crash components.
- **Exit Points:** Action triggers to transfer options.

### D. Send Money Flow
- **Happy Path:** Operator selects target profile/account, enters value, notes. Ledger confirms instantly, updates active balance with animation, and writes audit record.
- **Error States:** Transferring more than available balance throws "INSUFFICIENT_FUNDS".
- **Edge Cases:** Sending money to yourself triggers "SELF_TRANSACTION_REJECTED".
- **Exit Points:** Settle ledger log card updates automatically.

### E. Fraud Detection Flow
- **Happy Path:** User sends $6,000 (exceeds parameter threshold of $5,000). System immediately flags transaction, enters "PENDING_APPROVAL" state, flashes active alert banner on header, and writes "CRITICAL_THREAT_DETECTED" audit.
- **Error States:** Fraud rules can be tweaked by operators using toggles.
- **Exit Points:** Admin approves/denies transaction directly.

### F. Admin Audit Flow
- **Happy Path:** Admin toggles access views, inspects CPU/Memory spikes, watches logs scroll, and clears simulated database pools.
- **Error States:** Restricted operators attempting this get immediate visual RBAC feedback.

---

## 3. Navigation Map (Hierarchical App Structure)
```
[FinGuard root]
 ├── Landing Section (Hero, Security Metrics, Preset Selectors)
 ├── User Dashboard (Private Route - Checks Authentication & JWT)
 │    ├── Balance Widget (Multi-Currency Ledgers)
 │    ├── Fast Settlement Panel (Send Simulated Funds)
 │    └── Ledger Registry (All transactions)
 └── Infrastructure Audit Hub (Admin Route)
      ├── Security Center (RBAC controls & zero trust viz)
      ├── Fault Alerts (Interactive Fraud Control center)
      └── Infrastructure Telemetry (Grafana-style simulation charts, audit logs, and hardware tracking)
```

---

## 4. Screen Inventory

### Dashboard View (`/dashboard`)
- **Access Level:** Private (requires mock user authentication).
- **Purpose:** Primary workstation for transactions, wallet monitoring, and ledger settlements.
- **Key UI Elements:**
  - Balance indicator, wallet accounts grid, send money panel, activity streams.
- **Actions Available:**
  - Send funds, inspect raw JWT contents, trigger security lock, adjust simulation values.
- **State Variants:** Empty Ledger State, Overdrawn Warn State, Active Fraud Risk Alert.

### Telemetry Hub (`/telemetry`)
- **Access Level:** Operator / Administrator (RBAC verified).
- **Purpose:** Infrastructure health analytics, system auditing, and ledger validation.
- **Key UI Elements:**
  - Simulation telemetry graphs (CPU, Memory, Request rate, DB connection pool), real-time audit grid, DB replication state.
- **Actions Available:**
  - Clear database connections, trigger server panic simulation, download mock audit trail.

---

## 5. Critical System Decisions
- `IF amount > $5,000 THEN trigger Fraud Level High AND hold transaction`
- `IF role !== 'Admin' AND action == 'delete_db' THEN deny action AND write Security Threat log`
- `IF failed_logins >= 3 THEN lock_account for 30s`

---

## 6. Error Handling Flows
- **Unauthorized (401/403):** Display overlay showing access denied, suggesting appropriate role privileges.
- **Data Error (500):** System recovery option with detailed JSON debug trace.
- **Session Expiry:** Prompt to retest with automated 1-click token refresh.

---

## 7. Responsive Behavior
- **Desktop Grid:** Expanded 3-column dashboard spacing highlighting real-time stream graphs on the right column.
- **Mobile Adaptive View:** Tabbed navigation switcher on mobile viewports ensuring tactile buttons maintain minimum 44px hit-targets.
