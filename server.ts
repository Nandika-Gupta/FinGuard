/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { User, Wallet, Transaction, FraudAlert, AuditLog, SystemMetrics, UserRole } from "./src/types.js";

const app = express();
const PORT = 3000;

app.use(express.json());

// ==========================================
// IN-MEMORY DATABASE SEED STORES
// ==========================================

const users: User[] = [
  { id: "usr-admin", username: "admin_ledger", email: "admin@finguard.com", role: "Admin", createdAt: new Date().toISOString() },
  { id: "usr-operator", username: "analyst_ops", email: "ops@finguard.com", role: "Operator", createdAt: new Date().toISOString() },
  { id: "usr-cust0", username: "customer_zero", email: "zero@finguard.com", role: "User", createdAt: new Date().toISOString() },
  { id: "usr-cust1", username: "customer_one", email: "one@finguard.com", role: "User", createdAt: new Date().toISOString() },
];

const passwords: Record<string, string> = {
  "usr-admin": "password123",
  "usr-operator": "password123",
  "usr-cust0": "password123",
  "usr-cust1": "password123",
};

const wallets: Wallet[] = [
  { id: "wl-admin", userId: "usr-admin", accountNumber: "FG-WL-88001", balance: 100000, routingCode: "FG-RTE-90", createdAt: new Date().toISOString() },
  { id: "wl-operator", userId: "usr-operator", accountNumber: "FG-WL-55002", balance: 50000, routingCode: "FG-RTE-90", createdAt: new Date().toISOString() },
  { id: "wl-cust0", userId: "usr-cust0", accountNumber: "FG-WL-10042", balance: 75000, routingCode: "FG-RTE-90", createdAt: new Date().toISOString() },
  { id: "wl-cust1", userId: "usr-cust1", accountNumber: "FG-WL-20098", balance: 12500, routingCode: "FG-RTE-90", createdAt: new Date().toISOString() },
];

const transactions: Transaction[] = [
  {
    id: "tx-init-0",
    sourceWalletId: "wl-cust1",
    destWalletId: "wl-cust0",
    amount: 1500,
    type: "TRANSFER",
    status: "SETTLED",
    fraudRiskScore: 12,
    auditRef: "FG-REF-890214",
    notes: "Inbound treasury settlement test",
    senderName: "customer_one",
    receiverName: "customer_zero",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "tx-init-1",
    sourceWalletId: "wl-cust0",
    destWalletId: "wl-cust1",
    amount: 6000,
    type: "TRANSFER",
    status: "HELD",
    fraudRiskScore: 84,
    auditRef: "FG-REF-710492",
    notes: "Flagged exception - Pending manual compliance review",
    senderName: "customer_zero",
    receiverName: "customer_one",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  }
];

const fraudAlerts: FraudAlert[] = [
  {
    id: "frd-init-1",
    transactionId: "tx-init-1",
    triggerReason: "Transaction volume exceeds instant automated settlement threshold ($5,000)",
    riskLevel: "HIGH",
    status: "OPEN",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    amount: 6000,
    senderName: "customer_zero",
    receiverName: "customer_one",
  }
];

const auditLogs: AuditLog[] = [
  { id: "log-0", performedBy: "SYSTEM", ipAddress: "127.0.0.1", action: "COMPLIANCE_ENGINE_ARMED", details: "Automated risk mitigation monitor activated", createdAt: new Date(Date.now() - 3600000 * 5).toISOString() },
  { id: "log-1", performedBy: "SYSTEM", ipAddress: "127.0.0.1", action: "LEDGER_SYSTEM_ONLINE", details: "Double-entry assets ledger verified. Balanced ledger checks completed successfully", createdAt: new Date(Date.now() - 3600000 * 4).toISOString() },
  { id: "log-2", performedBy: "admin_ledger", ipAddress: "10.0.4.15", action: "SYSTEM_ACCESS", details: "Terminal session connected via institutional administration credentials", createdAt: new Date(Date.now() - 3600000 * 3).toISOString() },
];

// Brute force tracking
const failedLoginAttempts: Record<string, { count: number; lockUntil: number }> = {};

// ==========================================
// SECURITY MIDDLEWARES (SIMULATED JWT & RBAC)
// ==========================================

function getMockUserFromHeader(authHeader: string | undefined): User | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7);
  try {
    // Decodes simulated base64 representation of a token
    const decodedStr = Buffer.from(token, 'base64').toString('utf-8');
    const parsedPayload = JSON.parse(decodedStr);
    
    // Check expiration
    if (parsedPayload.expiry && Date.now() > parsedPayload.expiry) {
      return null;
    }
    
    const user = users.find((u) => u.id === parsedPayload.id);
    return user || null;
  } catch (e) {
    return null;
  }
}

// Global logger helper
function writeAuditLog(performedBy: string, ip: string, action: string, details: string) {
  const newLog: AuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
    performedBy,
    ipAddress: ip,
    action,
    details,
    createdAt: new Date().toISOString()
  };
  auditLogs.unshift(newLog);
  // Cap logs to 150 entries to preserve container memory
  if (auditLogs.length > 150) auditLogs.pop();
}

// Authentication interceptor
function requireAuth(req: any, res: any, next: any) {
  const authUser = getMockUserFromHeader(req.headers.authorization);
  if (!authUser) {
    return res.status(401).json({ error: "AUTHENTICATION_ERROR", message: "Active JWT signature verification failed or token signature has expired." });
  }
  req.user = authUser;
  next();
}

// Role-based restrict helper
function requireRole(roles: UserRole[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      writeAuditLog(
        req.user?.username || "ANONYMOUS",
        req.ip || "127.0.0.1",
        "COMPLIANCE_EXCEPTION",
        `Resource access rejected. Action requires privilege level: ${roles.join(", ")}. Active role: ${req.user?.role || "None"}`
      );
      return res.status(403).json({
        error: "ACCESS_DENIED",
        message: `Privilege exception: Client role status '${req.user?.role}' does not possess sufficient privileges for this procedure.`
      });
    }
    next();
  };
}

// ==========================================
// API REST ENDPOINTS
// ==========================================

// Auth - Register
app.post("/api/auth/register", (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "INVALID_PAYLOAD", message: "Missing required registration parameters." });
  }

  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: "PASSWORD_WEAK", message: "Username must be >= 3 chars, Password must be >= 6 chars." });
  }

  const existing = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: "REGISTRATION_ERROR", message: "Specified account username is already registered in the ledger index." });
  }

  // Create user
  const userId = `usr-${Date.now()}`;
  const userRole: UserRole = (role && ["User", "Operator", "Admin"].includes(role)) ? role as UserRole : "User";
  const newUser: User = {
    id: userId,
    username,
    email,
    role: userRole,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  passwords[userId] = password;

  // Automount user financial wallet with baseline mock balance
  const walletId = `wl-${userId}`;
  const newWallet: Wallet = {
    id: walletId,
    userId,
    accountNumber: `FG-WL-${Math.floor(10000 + Math.random() * 90000)}`,
    balance: 10000, // $10,000 sandbox starting balance
    routingCode: "FG-RTE-90",
    createdAt: new Date().toISOString()
  };
  wallets.push(newWallet);

  // Auto audit registration
  writeAuditLog(username, req.ip || "127.0.0.1", "ACCOUNT_REGISTERED", `Registered '${userRole}' account profile. Issued ledger accountNumber ${newWallet.accountNumber}.`);

  // Generate simulated Base64 token with 2 hour expiration
  const payload = { id: newUser.id, username: newUser.username, role: newUser.role, expiry: Date.now() + 3600000 * 2 };
  const mockToken = Buffer.from(JSON.stringify(payload)).toString("base64");

  res.json({ token: mockToken, user: newUser, wallet: newWallet });
});

// Auth - Login
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "INVALID_CREDENTIALS", message: "Username and passphrase credentials required." });
  }

  // Check Brute Force locks
  const tracker = failedLoginAttempts[username];
  if (tracker && tracker.count >= 3 && Date.now() < tracker.lockUntil) {
    const remains = Math.ceil((tracker.lockUntil - Date.now()) / 1000);
    return res.status(429).json({
      error: "RATE_LIMIT_LOCKOUT",
      message: `Brute-force connection rate limit lock active. Retrying blocked for another ${remains} seconds.`
    });
  }

  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user || passwords[user.id] !== password) {
    // Record failure
    if (!failedLoginAttempts[username]) {
      failedLoginAttempts[username] = { count: 0, lockUntil: 0 };
    }
    failedLoginAttempts[username].count++;
    if (failedLoginAttempts[username].count >= 3) {
      failedLoginAttempts[username].lockUntil = Date.now() + 30000; // 30 sec lockdown
      writeAuditLog("SYSTEM", req.ip || "127.0.0.1", "RATE_LIMIT_FLAG", `Rate mitigation system locked out brute-force suspect '${username}'. Retry threshold exceeded.`);
    }

    return res.status(401).json({
      error: "AUTHENTICATION_FAILED",
      message: `Credentials verification failed. Attempts remaining: ${Math.max(0, 3 - (failedLoginAttempts[username]?.count || 0))}`
    });
  }

  // Success: Clear trackers
  delete failedLoginAttempts[username];

  // Token: Base64 simulated bearer signed with mock configuration
  const payload = { id: user.id, username: user.username, role: user.role, expiry: Date.now() + 3600000 * 2 };
  const mockToken = Buffer.from(JSON.stringify(payload)).toString("base64");

  // Audit success
  writeAuditLog(user.username, req.ip || "127.0.0.1", "SESSION_AUTHORIZED", `Session successfully authorized with privilege role: ${user.role}`);

  const userWallet = wallets.find(w => w.userId === user.id) || null;

  res.json({ token: mockToken, user, wallet: userWallet });
});

// Wallet Info
app.get("/api/wallets/my", requireAuth, (req: any, res) => {
  const userWallet = wallets.find(w => w.userId === req.user.id);
  if (!userWallet) {
    return res.status(404).json({ error: "WALLET_NOT_FOUND", message: "No active ledgers mapped to this secure node." });
  }
  res.json(userWallet);
});

// Full accounts directory for sending targets
app.get("/api/wallets", requireAuth, (req, res) => {
  // Return readable list of available transfer nodes (filtered to public safe profiles)
  const directory = wallets.map(w => {
    const owner = users.find(u => u.id === w.userId);
    return {
      walletId: w.id,
      accountNumber: w.accountNumber,
      username: owner ? owner.username : "External Account",
      routingCode: w.routingCode
    };
  });
  res.json(directory);
});

// Ledger Transactions - Create
app.post("/api/transactions", requireAuth, (req: any, res) => {
  const { destWalletNumber, amount, notes } = req.body;
  const numAmount = Number(amount);

  if (!destWalletNumber || isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "INVALID_TRANSACTION", message: "Destination wallet account and a valid positive amount is required." });
  }

  const senderWallet = wallets.find(w => w.userId === req.user.id);
  if (!senderWallet) {
    return res.status(404).json({ error: "WALLET_NOT_FOUND", message: "Source wallet account mismatch." });
  }

  const targetWallet = wallets.find(w => w.accountNumber === destWalletNumber);
  if (!targetWallet) {
    return res.status(404).json({ error: "RECEIVER_NOT_FOUND", message: "Target account database query failed. Invalid routing parameters." });
  }

  if (senderWallet.id === targetWallet.id) {
    return res.status(400).json({ error: "TRANSACTION_REJECTED", message: "Self-transfers are forbidden. Source and destination wallets must be distinct." });
  }

  if (senderWallet.balance < numAmount) {
    return res.status(400).json({ error: "CREDIT_DENIED", message: "Ledger settlement denied. Insufficient funds in source bank account." });
  }

  // FRAUD DETECTION CHECK
  // Rule A: Limit threshold exceeded (amount > $5,000)
  // Rule B: Rapid risk escalation (notes containing "urgent", "crypt", "hack", or "override")
  let fraudRiskScore = Math.floor(5 + Math.random() * 20); // standard baseline noise
  const notesStr = (notes || "").toLowerCase();
  
  if (numAmount >= 5000) {
    fraudRiskScore += 45;
  }
  if (notesStr.includes("urgent") || notesStr.includes("override") || notesStr.includes("crypto") || notesStr.includes("bypass")) {
    fraudRiskScore += 35;
  }
  fraudRiskScore = Math.min(100, fraudRiskScore);

  const isFraudHeld = fraudRiskScore >= 75;
  const txStatus = isFraudHeld ? "HELD" : "SETTLED";
  const transactionId = `tx-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const auditRef = `FG-REF-${Math.floor(100000 + Math.random() * 900000)}`;

  const destUser = users.find(u => u.id === targetWallet.userId);

  const newTx: Transaction = {
    id: transactionId,
    sourceWalletId: senderWallet.id,
    destWalletId: targetWallet.id,
    amount: numAmount,
    type: "TRANSFER",
    status: txStatus,
    fraudRiskScore,
    auditRef,
    notes: notes || "Standard inter-account wallet wire",
    senderName: req.user.username,
    receiverName: destUser ? destUser.username : "Unknown Beneficiary",
    createdAt: new Date().toISOString()
  };

  transactions.unshift(newTx);

  if (!isFraudHeld) {
    // Settle Ledger Immediately: Atomic transfer
    senderWallet.balance -= numAmount;
    targetWallet.balance += numAmount;

    writeAuditLog(
      req.user.username, 
      req.ip || "127.0.0.1", 
      "LEDGER_SETTLEMENT", 
      `Transferred $${numAmount.toLocaleString()} to account ${targetWallet.accountNumber}. Reference: ${auditRef}`
    );
  } else {
    // Hold money: Create alarm
    const alertId = `frd-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newAlert: FraudAlert = {
      id: alertId,
      transactionId: transactionId,
      triggerReason: numAmount >= 5000 
        ? `Double-Entry limit exceeded ($${numAmount.toLocaleString()} >= $5,000 limit threshold)`
        : `Suspect payment reference matching transaction filters (Memo: '${notes}')`,
      riskLevel: "HIGH",
      status: "OPEN",
      createdAt: new Date().toISOString(),
      amount: numAmount,
      senderName: req.user.username,
      receiverName: destUser ? destUser.username : "Unknown Beneficiary"
    };

    fraudAlerts.unshift(newAlert);

    writeAuditLog(
      "RISK_ENGINE", 
      "127.0.0.1", 
      "COMPLIANCE_EXCEPTION_HOLD", 
      `High Risk Score (${payloadRiskAssessment(fraudRiskScore)}) detected on transfer ID FG-REF-${auditRef}. Holding transaction for administrator compliance override.`
    );
  }

  res.json({
    transaction: newTx,
    actionsSucceeded: !isFraudHeld,
    status: txStatus,
    riskScore: fraudRiskScore,
    message: isFraudHeld 
      ? "COMPLIANCE ACTION: Settlement held for administrator validation due to escalated risk score." 
      : "Transfer completed and registered in ledger logs."
  });
});

function payloadRiskAssessment(score: number): string {
  if (score < 40) return "LOW";
  if (score < 75) return "MEDIUM";
  return "HIGH_OR_CRITICAL";
}

// Ledger History
app.get("/api/transactions/history", requireAuth, (req: any, res) => {
  // If Admin/Operator, can fetch ALL transactions, otherwise only user's transactions
  const userWallet = wallets.find(w => w.userId === req.user.id);
  if (!userWallet) {
    return res.status(404).json({ error: "WALLET_NOT_FOUND", message: "User account records missing." });
  }

  if (req.user.role === "Admin" || req.user.role === "Operator") {
    return res.json(transactions);
  } else {
    const userTxs = transactions.filter(t => t.sourceWalletId === userWallet.id || t.destWalletId === userWallet.id);
    return res.json(userTxs);
  }
});

// Fraud Alerts - Admin & Operator
app.get("/api/admin/fraud/alerts", requireAuth, requireRole(["Admin", "Operator"]), (req, res) => {
  res.json(fraudAlerts);
});

// Fraud Alerts Resolution
app.post("/api/admin/fraud/resolve", requireAuth, requireRole(["Admin"]), (req: any, res) => {
  const { alertId, action } = req.body; // action: 'APPROVE' (settle) or 'REJECT' (cancel)

  if (!alertId || !["APPROVE", "REJECT"].includes(action)) {
    return res.status(400).json({ error: "INVALID_RESOLUTION", message: "Alert ID and a resolution action is mandatory." });
  }

  const alertIndex = fraudAlerts.findIndex(a => a.id === alertId);
  if (alertIndex === -1) {
    return res.status(404).json({ error: "ALERT_NOT_FOUND", message: "Specified compliance hold record is missing." });
  }

  const alert = fraudAlerts[alertIndex];
  const tx = transactions.find(t => t.id === alert.transactionId);
  if (!tx) {
    return res.status(404).json({ error: "TRANSACTION_NOT_FOUND", message: "Ledger transaction linking the compliance alert does not exist." });
  }

  if (tx.status !== "HELD") {
    return res.status(400).json({ error: "TRANSACTION_NOT_HELD", message: "Ledger state is not pending manual compliance review. Change rejected." });
  }

  const sourceWallet = wallets.find(w => w.id === tx.sourceWalletId);
  const destWallet = wallets.find(w => w.id === tx.destWalletId);

  if (!sourceWallet || !destWallet) {
    tx.status = "REJECTED";
    alert.status = "RESOLVED_DENIED";
    return res.status(400).json({ error: "WALLETS_MISALIGNED", message: "Signatures corresponding with nodes withdrew or unregistered." });
  }

  if (action === "APPROVE") {
    // Check sender still has sufficient cash
    if (sourceWallet.balance < tx.amount) {
      tx.status = "REJECTED";
      alert.status = "RESOLVED_DENIED";
      writeAuditLog(
        req.user.username,
        req.ip || "127.0.0.1",
        "OVERRIDE_FAILED",
        `Approved held transaction FG-REF-${tx.auditRef} but sender balance dried. Transaction voided.`
      );
      return res.status(400).json({ error: "INSUFFICIENT_FUNDS_DURING_SETTLE", message: "Caller source ledger balance insufficient since alert logged." });
    }

    // Atomic Settle
    sourceWallet.balance -= tx.amount;
    destWallet.balance += tx.amount;
    tx.status = "SETTLED";
    alert.status = "RESOLVED";

    writeAuditLog(
      req.user.username,
      req.ip || "127.0.0.1",
      "COMPLIANCE_OVERRIDE_APPROVED",
      `Approved held transfer ID FG-REF-${tx.auditRef} of $${tx.amount.toLocaleString()}. Funds successfully settled.`
    );
  } else {
    // REJECT
    tx.status = "REJECTED";
    alert.status = "RESOLVED_DENIED";

    writeAuditLog(
      req.user.username,
      req.ip || "127.0.0.1",
      "COMPLIANCE_OVERRIDE_REJECTED",
      `Voided held transaction ID FG-REF-${tx.auditRef} of $${tx.amount.toLocaleString()}. Vault funds preserved.`
    );
  }

  res.json({ success: true, transactionStatus: tx.status, alertStatus: alert.status });
});

// Admin System log feeds
app.get("/api/admin/audit-logs", requireAuth, requireRole(["Admin", "Operator"]), (req, res) => {
  res.json(auditLogs);
});

// Admin infrastructure metric generation
app.get("/api/admin/metrics", requireAuth, requireRole(["Admin", "Operator"]), (req, res) => {
  // Generate highly realistic fluctuating dashboard telemetry indicators
  const metrics: SystemMetrics = {
    cpuUsage: Math.floor(18 + Math.random() * 12),
    memoryUsage: Math.floor(45 + Math.random() * 4),
    requestRate: Math.floor(8 + Math.random() * 4),
    activeConnections: users.length + Math.floor(Math.random() * 3),
    replicaDelayMs: Math.floor(2 + Math.random() * 3),
    transactionPoolSize: transactions.filter(t => t.status === "HELD").length,
    secureChannelStatus: fraudAlerts.some(a => a.status === "OPEN") ? "STRESSED" : "HEALTHY",
    bruteForceAttempts: Object.keys(failedLoginAttempts).reduce((acc, key) => acc + failedLoginAttempts[key].count, 0),
    blockedIPsCount: Object.values(failedLoginAttempts).filter(v => v.lockUntil > Date.now()).length
  };
  res.json(metrics);
});

// Seed Funds - Simulated sandbox wire funding
app.post("/api/wallets/faucet", requireAuth, (req: any, res) => {
  const { amount } = req.body;
  const numAmount = Number(amount);

  if (isNaN(numAmount) || numAmount <= 0 || numAmount > 100000) {
    return res.status(400).json({ error: "INVALID_FAUCET_CALL", message: "Please specify a capital injection value between $1 and $100,000." });
  }

  const wallet = wallets.find(w => w.userId === req.user.id);
  if (!wallet) {
    return res.status(404).json({ error: "WALLET_NOT_FOUND", message: "Linked bank account profile missing." });
  }

  wallet.balance += numAmount;

  writeAuditLog(
    req.user.username,
    req.ip || "127.0.0.1",
    "RESERVES_INJECTED",
    `Injected sandbox cash reserves: +$${numAmount.toLocaleString()} to account FG-WL-${wallet.accountNumber}`
  );

  res.json({ success: true, newBalance: wallet.balance });
});

// ==========================================
// VITE AND PRODUCTION STATIC COMPILERS
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static outputs
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FinGuard Server] Online and routing requests securely on port ${PORT}`);
  });
}

startServer();
