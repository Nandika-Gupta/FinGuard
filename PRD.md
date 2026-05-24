# Product Requirements Document (PRD): FinGuard

## 1. Product Overview
FinGuard is a high-fidelity fintech infrastructure simulator designed to mimic the architecture, security patterns, and operations of secure enterprise banking systems. The platform provides an educational, interactive ecosystem where developers, students, and recruiters can inspect, configure, and simulate high-threat transactions, role-based controls, core ledgers, and live telemetry.

## 2. Problem Statement
Most student and early-portfolio credit projects suffer from a lack of production-grade realism. Traditional "clone" projects rarely demonstrate the critical pillars of true fintech engineering—Zero Trust access controls, real-time fraud scoring, audit trail immutability, role separation, and high-availability systems. FinGuard fills this gap by turning invisible back-end systems (rate limiting, secure credential hashing, ledger double-entry checks, intrusion prevention) into a tangible, interactive full-stack simulator.

## 3. Goals & Objectives
- **Demonstrate Enterprise Architecture:** Highlight complex backend operations (such as rate limits, JWT expirations, and ledger entries) via dashboard animations.
- **Provide Actionable Simulation:** Allow users to build active ledger logs, generate mock fraud alerts by forcing high-risk metrics, and manage user permissions dynamically.
- **Minimize Barrier of Entry:** Ship a fully functional, secure system that runs natively in a containerized playground without external dependencies.

## 4. Success Metrics
- **Verification Integrity:** 100% of simulated double-entry transactions must settle with matching net debits/credits across all entities.
- **Zero-Friction Sim State:** Admin and user sessions should maintain active telemetry and configuration inputs reliably.

## 5. Target Personas
1. **The Fintech Recruiter / Lead Engineer:** Enjoys reviewing candidate systems designs. Seeks high-fidelity components, compliance audits, and responsive monitoring over basic CRUD tables.
2. **The Security/Systems Student:** Wants to visualize how security interceptors, role-based guardrails, and fraud algorithms catch anomalies.

---

## 6. Feature Scope

### P0 (MVP Components)

#### 1. User Authentication & JWT Handling
- **Description:** Real secure login using mock robust server-side hashing, session tokens, refresh tokens, and rate-limiting.
- **User Story:** As an operator, I want to securely log in so that I only interact with accounts suited to my security level.
- **Acceptance Criteria:**
  - Standard JWT with expiration tracking visualized on screen.
  - Brute force protection (automatic lockouts upon 3 consecutive failed logins).
- **Success Metrics:** Zero authentication bypass opportunities; session expiration timer updates in real time.

#### 2. Wallet Dashboard & Multi-Entity Ledger
- **Description:** Client wallets representing multi-currency cash holdings, displaying active account numbers.
- **User Story:** As a wallet owner, I want to view my settled balances instantly.
- **Acceptance Criteria:**
  - Visualizing ledger integrity with clear cash-in/cash-out indicators.
- **Success Metrics:** Wallet balances never fall below zero (unless overdrawn limit is simulated and configured).

#### 3. Send Money Simulation (Ledger Settlements)
- **Description:** Double-entry ledger simulated transaction from Wallet A to Wallet B.
- **User Story:** As a platform developer, I want to send simulated funds between internal nodes to verify balance transfer accuracy.
- **Acceptance Criteria:**
  - Must validate recipient routing/account numbers.
  - Generates transaction references immediately.
- **Success Metrics:** Processing time is under 150ms in simulated API response.

#### 4. Audit Logging Systems (Immutability Viz)
- **Description:** Append-only log files generated automatically on every key event.
- **User Story:** As a compliance officer, I need to see a live-feed list of admin operations so that I can audit historical activities.
- **Acceptance Criteria:**
  - High-visibility tabular lists carrying action types, IP, and UTC timestamps.
- **Success Metrics:** Log list persists across user sessions.

#### 5. Fraud Detection Alerts
- **Description:** Real-time analysis of transaction limits, trigger conditions, and flagging of high-velocity activities.
- **User Story:** As an operations admin, I want suspicious transfers automatically flagged for dual-factor review.
- **Acceptance Criteria:**
  - High transaction amounts or rapid transactions trigger an immediate alert banner and warning dialog.
- **Success Metrics:** False-positive settings can be customized in the simulator panel.

#### 6. Role-Based Access Control (RBAC) Simulator
- **Description:** Dynamic switching between user accounts (Admin, Operator, General User) to restrict application privileges dynamically.
- **User Story:** As a platform owner, I want to verify that an Operator account cannot delete databases.
- **Acceptance Criteria:**
  - Live visual lock overlay or access denied state on UI elements when restricted permissions are clicked.
- **Success Metrics:** Securely enforced by server-side middleware simulation.

#### 7. Core Monitoring Dashboard (Telemetry)
- **Description:** Multi-chart dashboard capturing server health status, active API rate, load-balancer simulations, and fake DB pool logs.
- **User Story:** As an infrastructure engineer, I need to track simulated CPU, request rates, page pings, and database memory.
- **Acceptance Criteria:**
  - Real-time charting with customized intervals showing clean, simulated fluctuations.
- **Success Metrics:** Highly responsive transitions without infinite React rendering cycles.

### P1 Features (Planned Expansion)
- Custom rate-limiter slider inputs for live testing of system boundaries.
- Database replication logs visualizer mimicking primary-secondary mirror synchronization.

### P2 Features (Future Backlog)
- Sandbox attack trigger events (e.g. simulate generic SQL Injection or DDoS attacks and watch FinGuard auto-mitigate).

---

## 7. Explicitly OUT OF SCOPE
The simulator prioritizes architectural visualization over operational connections. The following are strictly excluded:
- **Real Banking Integration:** No connections to Plaid, Stripe API, or SWIFT/ACH networks.
- **Actual Money Transfer:** All currencies, ledger units, and balances are purely simulated.
- **Crypto / Blockchain:** No smart contracts, wallets, or blockchain ledgers.
- **Investment Systems:** No stock portfolios or trading modules.
- **Loan Approvals:** No actual interest calculations or credit card approvals.
- **KYC Verification:** No actual SSN or biometric uploads.

---

## 8. User Scenarios

### Scenario A: User Registration
1. User loads the main page and selects "Register New Infrastructure Node".
2. Enters user information, a strong password, and selects an initial role (Admin, Operator, or User).
3. The system hashes the password simulated on the server, generates a secure wallet, and grants a $10,000 baseline balance.

### Scenario B: Secure Login
1. User enters invalid credentials twice.
2. An indicator alerts the user that brute force system limits are incrementing (Rate Limit: 2/3).
3. User enters correct credentials on second attempt; server grants JWT and launches the dashboard.

### Scenario C: Sending Transaction & Fraud Trigger
1. User initiates a transfer of $8,500.
2. The fraud system detects that this exceeds the instant limit parameters ($5,000 threshold).
3. The transaction is held in secondary review, trigger indicators illuminate, and a fraud alert record is saved.

### Scenario D: System Log Review
1. Dynamic telemetry panel logs the exact UTC timestamps of all database reads, ledger settlements, and privilege elevations.

---

## 9. Non-Functional Requirements (NFR)
- **Security:** Demonstrate bcrypt password patterns, JWT structures, secure cookies, and CORS concepts.
- **Scalability:** Frontend structures organized into clean, reusable React components to limit file volume.
- **Reliability:** Graceful error fallbacks for simulation inputs.
- **Performance:** Sub-100ms UI responsiveness for optimal dashboard experience.
- **Accessibility:** Ensure high color-contrast ratio across dark and light designs, maintaining readable typography.
