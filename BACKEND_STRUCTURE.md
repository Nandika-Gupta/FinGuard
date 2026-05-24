# Backend System Architecture & Specifications: FinGuard

## 1. Relational Model & Simulation Engine
To maintain high-fidelity without requiring complex PostgreSQL database containers, FinGuard implements an in-memory double-entry ledger database simulation that behaves as a relational ledger manager. This guarantees data preservation, database constraints enforcement, transaction rollbacks for errors, and live telemetry outputs.

### Schema Blueprint (Tables Layout)

#### Users (`users`)
- `id` (UUID, Primary Key)
- `username` (VARCHAR, Unique, Unique index)
- `email` (VARCHAR, Unique)
- `password_hash` (VARCHAR)
- `role` (VARCHAR, Default 'User', checks 'User'|'Operator'|'Admin')
- `created_at` (TIMESTAMP UTC)
- `updated_at` (TIMESTAMP UTC)

#### Wallets (`wallets`)
- `id` (VARCHAR, Primary Key)
- `user_id` (UUID, Foreign Key User)
- `account_number` (VARCHAR, Unique)
- `balance` (DECIMAL, Check >= 0)
- `routing_code` (VARCHAR)
- `created_at` (TIMESTAMP UTC)
- `updated_at` (TIMESTAMP UTC)

#### Ledger Transactions (`transactions`)
- `id` (UUID, Primary Key)
- `source_wallet_id` (VARCHAR, Foreign Key Wallet)
- `dest_wallet_id` (VARCHAR, Foreign Key Wallet)
- `amount` (DECIMAL, Check > 0)
- `type` (VARCHAR, 'TRANSFER' | 'DEPOSIT' | 'WITHDRAWAL')
- `status` (VARCHAR, 'SETTLED' | 'HELD' | 'REJECTED')
- `fraud_risk_score` (INTEGER, range 0-100)
- `audit_ref` (VARCHAR, Unique index)
- `created_at` (TIMESTAMP UTC)

#### Fraud Alarms (`fraud_alerts`)
- `id` (UUID, Primary Key)
- `transaction_id` (UUID, Foreign Key Transaction)
- `trigger_reason` (VARCHAR)
- `risk_level` (VARCHAR, 'LOW' | 'MEDIUM' | 'HIGH')
- `status` (VARCHAR, 'OPEN' | 'RESOLVED' | 'RESOLVED_DENIED')
- `created_at` (TIMESTAMP UTC)

#### Audit System Log (`audit_logs`)
- `id` (UUID, Primary Key)
- `performed_by` (VARCHAR, username or 'SYSTEM')
- `ip_address` (VARCHAR)
- `action` (VARCHAR)
- `details` (VARCHAR)
- `created_at` (TIMESTAMP UTC)

---

## 2. API Endpoint Inventory

### Auth Node
- **`POST /api/auth/register`**
  - Enforce password strength minimums. Enforces default user or specified RBAC creation.
  - Return: JSON token payload + created user details.
- **`POST /api/auth/login`**
  - Verify credentials. Locks out user upon 3 consecutive failures.
  - Return: JWT Bearer ticket model.
- **`POST /api/auth/logout`**
  - Clear simulated tokens and notify logs.

### Financial Transactions Node
- **`POST /api/transactions`**
  - Initiates multi-step, double-entry settlement.
  - Interceptors: Verify sender has enough funds, verify receiver wallet exists, analyze risk score.
  - Return: Settle confirmation metadata.
- **`GET /api/transactions/history`**
  - Returns authenticated user's audit listings.

### Infrastructure Systems Node
- **`GET /api/admin/metrics`**
  - Returns live telemetry curves.
- **`GET /api/admin/logs`**
  - Audit trail viewer.
- **`POST /api/admin/fraud/resolve`**
  - Allows Admins to approve/deny active holds.

---

## 3. High Availability Replication Logic
FinGuard simulated DB features primary-secondary synchronization logs:
- Every data write is pushed to the PRIMARY record pool.
- Within 15ms of a write event, a simulated secondary replica emits a replication transaction log (`REPLICA_SYNC_COMPLETE`), maintaining simulated high availability redundancy.
