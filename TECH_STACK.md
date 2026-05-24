# Technology Stack & Environment Configuration: FinGuard

## 1. Core Runtime & Tooling

### Frontend Architecture
- **React v19.0.1:** Modern functional component pattern, hooks, and Context.
- **TypeScript v5.8.2:** Typed interface contracts ensuring payload safety.
- **Tailwind CSS v4.1.14:** High-performance, compile-time forward styling framework.
- **Motion v12.23.24:** High-fidelity animations for charting, state transitions, and modal alerts.
- **Lucide React v0.546.0:** High-clarity, pixel-perfect modern web icon structures.

### Backend Architecture
- **Node.js Environment (v22):** Server-side JS environment powering the simulator backend.
- **Express.js v4.21.2:** Single-threaded asynchronous server, mounting secure middleware routing and telemetry generators.
- **Simulated SQL DB Engine:** Fully functional in-memory backend database modeling relation schemas, primary keys, foreign constraints, audit streams, and real-time rollbacks.

---

## 2. Environment Configurations (`.env.example`)
All keys must be mirrored inside your deployment configuration:
```env
# Root Secret for server-side cryptology signatures
JWT_SECRET_KEY="finguard_secure_secret_hash_value"

# Simulator parameter overrides
DEFAULT_FRAUD_LIMIT=5000
SYSTEM_MONITOR_TICK_RATE_MS=1000
```

---

## 3. Package Scripts Configuration
The server configurations are built around dual Vite and Express coordination:
- **Development Script:** `tsx server.ts`
- **Build Script:** `vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`
- **Start Script:** `node dist/server.cjs`

---

## 4. Security Configuration Parameters

### Simulated Rate Limiting Rule Set
- **Public Auth Routes (`/api/auth/*`):** Max 3 attempts inside 30 seconds.
- **Ledger Ingress (`/api/transactions`):** Max 6 settlements inside 10 seconds.
- **Log Fetching Admin Nodes:** Max 20 streams inside 10 seconds.

### Secure Auth Lifecycle (Simulated JWT)
- **Token Format:** Base64-encoded bearer signature payload containing `userId`, `username`, `role`, and `expiry`.
- **Validation Engine:** Express middlewares inspect header Bearer string, compare expiry clocks, and intercept restricted pathways.
- **Role Permissions Mapping:**
  - `User`: Transfer money, view personal logs, inspect own JWT.
  - `Operator`: View system dashboard, inspect security alarms.
  - `Admin`: Approve/Reject held fraud transfers, clean DB pools, clear memory, download logs.
