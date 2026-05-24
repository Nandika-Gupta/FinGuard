/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Shield, 
  Terminal, 
  Wallet as WalletIcon, 
  ArrowRightLeft, 
  AlertTriangle, 
  Activity, 
  Database, 
  Users, 
  Lock, 
  Unlock, 
  User as UserIcon, 
  LogOut, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  HelpCircle,
  FileSpreadsheet,
  Globe,
  Cpu,
  Fingerprint,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User, Wallet, Transaction, FraudAlert, AuditLog, SystemMetrics, UserRole } from "./types.js";

const TOKEN_KEY = "finguard_jwt_token";
const USER_KEY = "finguard_user_context";

export default function App() {
  // State definitions
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletsDirectory, setWalletsDirectory] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  
  // Navigation tabs: 'wallet' | 'fraud' | 'metrics' | 'audit'
  const [activeTab, setActiveTab] = useState<string>("wallet");
  
  // Custom Landing/Auth view state
  const [viewMode, setViewMode] = useState<"landing" | "auth">("landing");
  
  // Auth Form State
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [roleInput, setRoleInput] = useState<UserRole>("User");
  
  // Transfer Form State
  const [targetWalletNum, setTargetWalletNum] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferMessage, setTransferMessage] = useState<{ type: "success" | "error" | "warn", text: string } | null>(null);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  
  // Faucet state
  const [faucetAmount, setFaucetAmount] = useState("10000");
  const [isFauceting, setIsFauceting] = useState(false);
  
  // Global error overlay
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);
  
  // Interactive audit overlay card
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);

  // Authentication error lock tracking
  const [loginErrorMsg, setLoginErrorMsg] = useState("");

  // System status feed (continuous live logs mimicking console dump)
  const [consoleLogs, setConsoleLogs] = useState<string[]>(["[09:00:00 UTC] FinGuard System core initialised.", "[09:00:02 UTC] TLS v1.3 handshake verification routine active."]);

  // Telemetry loop ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Parse JWT token fields visually
  const [jwtHeader, setJwtHeader] = useState("");
  const [jwtPayload, setJwtPayload] = useState("");
  const [jwtSignature, setJwtSignature] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  // ==========================================
  // INITIALIZERS & TOKENS DECODER
  // ==========================================

  useEffect(() => {
    if (token) {
      decodeVisualToken(token);
      fetchAllData();
      // Start polling telemetry
      startTelemetryPolling();
    } else {
      stopTelemetryPolling();
      // Clear sensitive states
      setWallet(null);
      setTransactions([]);
      setAlerts([]);
      setLogs([]);
      setMetrics(null);
    }
    return () => stopTelemetryPolling();
  }, [token]);

  const decodeVisualToken = (jwtStr: string) => {
    try {
      if (!jwtStr) {
        setJwtHeader("{ \"error\": \"No token present\" }");
        setJwtPayload("{ \"claims\": null }");
        setJwtSignature("");
        return;
      }
      
      const safeAtob = (str: string) => {
        try {
          // Remove any Bearer prefix
          const cleanStr = str.replace(/^Bearer\s+/i, '').trim();
          const parts = cleanStr.split('.');
          const b64 = parts.length === 3 ? parts[1] : cleanStr;
          
          let standardB64 = b64.replace(/-/g, '+').replace(/_/g, '/');
          while (standardB64.length % 4 !== 0) {
            standardB64 += '=';
          }
          const binary = atob(standardB64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return new TextDecoder().decode(bytes);
        } catch (e) {
          try {
            return atob(str);
          } catch {
            return str;
          }
        }
      };

      const decodedStr = safeAtob(jwtStr);
      const parsed = JSON.parse(decodedStr);
      
      setJwtHeader(JSON.stringify({ alg: "HS256", typ: "JWT" }, null, 2));
      setJwtPayload(JSON.stringify({ 
        userId: parsed.id || parsed.userId || "usr-unknown",
        username: parsed.username || "unknown",
        role: parsed.role || "User",
        clearanceLevel: parsed.role === "Admin" ? "3_SYSTEM_ADMINISTRATOR" : parsed.role === "Operator" ? "2_RISK_OPERATOR" : "1_CLIENT_ACCOUNT",
        expires: parsed.expiry ? new Date(parsed.expiry).toISOString() : "NEVER_EXPIRES",
        issuer: "finguard_ledger_iss"
      }, null, 2));
      setJwtSignature("DEFE891A0B598F123C00A89AF56DFAEE8992147BCD56FFD2A8");
    } catch (e) {
      setJwtHeader("{ \"error\": \"Malformed JWT token signature\" }");
      setJwtPayload("{ \"claims\": null }");
      setJwtSignature("");
    }
  };

  const startTelemetryPolling = () => {
    stopTelemetryPolling();
    fetchMetrics();
    timerRef.current = setInterval(() => {
      fetchMetrics();
      // Add a randomized console log mimicking active operations
      const operations = [
        "Database pool replica sync complete inside 12ms",
        "Compliance rule engine validated endpoint signature",
        "Rate-limiting check executed. 0 violations.",
        "Gateway adapter health check complete: status GREEN",
        "Bcrypt encryption buffer cycle loaded",
        "Risk monitors checked general settlement velocity"
      ];
      const randomMsg = operations[Math.floor(Math.random() * operations.length)];
      const now = new Date().toLocaleTimeString("en-GB", { timeZone: "UTC" });
      setConsoleLogs(prev => [`[${now} UTC] SYSTEM_INFO: ${randomMsg}`, ...prev.slice(0, 15)]);
    }, 3000);
  };

  const stopTelemetryPolling = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const fetchAllData = async () => {
    if (!token) return;
    setIsSyncing(true);
    try {
      await Promise.all([
        fetchWallet(),
        fetchWalletsDirectory(),
        fetchTransactions(),
        fetchAlerts(),
        fetchAuditLogs()
      ]);
    } catch (err) {
      console.error("Data ingestion failed", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // ==========================================
  // SERVER REST ACTIONS
  // ==========================================

  const authHeaders = () => ({
    "Content-Type": "application/json",
    "Authorization": token ? `Bearer ${token}` : ""
  });

  const handleResponseError = async (res: Response) => {
    const data = await res.json();
    if (res.status === 401 || res.status === 403) {
      // Automatic session lockout verification testing
      addConsoleEntry(`SECURITYEXCEPTION: HTTP ${res.status} returned. Token status unauthorized.`);
      if (res.status === 401) {
        handleLogout();
        showError(`Session invalidated: ${data.message || 'Please log in again.'}`);
        return;
      }
    }
    throw new Error(data.message || "An unexpected infrastructure error occurred.");
  };

  const fetchWallet = async () => {
    try {
      const res = await fetch("/api/wallets/my", { headers: authHeaders() });
      if (!res.ok) {
        await handleResponseError(res);
        return;
      }
      const data = await res.json();
      setWallet(data);
    } catch (err: any) {
      showError(err.message);
    }
  };

  const fetchWalletsDirectory = async () => {
    try {
      const res = await fetch("/api/wallets", { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setWalletsDirectory(data);
      }
    } catch (err) {}
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch("/api/transactions/history", { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {}
  };

  const fetchAlerts = async () => {
    if (user?.role === "User") return;
    try {
      const res = await fetch("/api/admin/fraud/alerts", { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (err) {}
  };

  const fetchAuditLogs = async () => {
    if (user?.role === "User") return;
    try {
      const res = await fetch("/api/admin/audit-logs", { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {}
  };

  const fetchMetrics = async () => {
    if (!token || user?.role === "User") return;
    try {
      const res = await fetch("/api/admin/metrics", { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {}
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrorMsg("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setLoginErrorMsg(data.message || "Credential verification failed.");
        return;
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setWallet(data.wallet);
      showSuccess(`Authorized Session Profile Connected: ${data.user.username}`);
      addConsoleEntry(`COMPLIANCE_LOG: Session token received. General rate checks: NOMINAL.`);
    } catch (err: any) {
      setLoginErrorMsg("Internal gateway connection failed.");
    }
  };

  // Register Handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrorMsg("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: usernameInput,
          email: emailInput,
          password: passwordInput,
          role: roleInput
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginErrorMsg(data.message || "Registry indexing failed.");
        return;
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setWallet(data.wallet);
      showSuccess(`Account initialized. Mapped wallet FG-WL with $10,000 Sandbox reserves.`);
      addConsoleEntry(`COMPLIANCE_LOG: Sandbox terminal provisioned. Access role initialized to ${data.user.role}.`);
    } catch (err) {
      setLoginErrorMsg("Internal gateway ledger mapping exception.");
    }
  };

  // Dynamic Faucet handler
  const handleFaucet = async () => {
    setIsFauceting(true);
    try {
      const res = await fetch("/api/wallets/faucet", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ amount: Number(faucetAmount) })
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message);
        return;
      }
      showSuccess(`Liquidity generated: +$${Number(faucetAmount).toLocaleString()} added to sandbox balance.`);
      addConsoleEntry(`TRANSACTION_LOG: Treasury faucet credited merchant wallet. Settlement matches.`);
      fetchWallet();
      fetchAuditLogs();
    } catch (err) {
      showError("Liquidity route did not process.");
    } finally {
      setIsFauceting(false);
    }
  };

  // Transaction Transfer Handler
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferMessage(null);
    setIsSubmittingTransfer(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          destWalletNumber: targetWalletNum,
          amount: Number(transferAmount),
          notes: transferNotes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setTransferMessage({ type: "error", text: data.message });
        addConsoleEntry(`RISK_ENGINE_REJECT: Settlement message failed: ${data.message}`);
        return;
      }

      if (data.status === "HELD") {
        setTransferMessage({
          type: "warn",
          text: `REGULATORY COMPLIANCE HOLD: ${data.message}`
        });
        addConsoleEntry(`RISK_ALERT: Transaction of $${Number(transferAmount).toLocaleString()} held in Compliance Hold queue. Review pending.`);
      } else {
        setTransferMessage({
          type: "success",
          text: `Settlement Cleared! ${data.message}`
        });
        addConsoleEntry(`SETTLEMENT_SUCCESS: Double-entry ledger settlement complete. Verification reference: ${data.transaction.auditRef}`);
        // Reset inputs
        setTargetWalletNum("");
        setTransferAmount("");
        setTransferNotes("");
      }

      // Reload
      fetchAllData();
    } catch (err: any) {
      setTransferMessage({ type: "error", text: "Transaction transmission failed." });
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Resolve Suspicious Alerts (Approve / Reject)
  const handleResolveAlert = async (alertId: string, action: "APPROVE" | "REJECT") => {
    try {
      const res = await fetch("/api/admin/fraud/resolve", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ alertId, action })
      });

      const data = await res.json();
      if (!res.ok) {
        showError(data.message);
        addConsoleEntry(`OVERRIDE_FAILURE: Audit override error: ${data.message}`);
        return;
      }

      showSuccess(`Override complete. Ledger status: ${action}D successfully.`);
      addConsoleEntry(`AUDIT_OVERRIDE: Alert ID ${alertId} solved via operator override. Ledger state: ${action}D.`);
      setSelectedAlert(null);
      // Reload everything
      fetchAllData();
    } catch (err) {
      showError("Alert routing resolved poorly.");
    }
  };

  // Simulation controls: Instant Developer Presets Login
  const handlePresetLogin = async (username: string, roleLabel: string) => {
    setUsernameInput(username);
    setPasswordInput("password123");
    setIsRegisterMode(false);
    
    // Auto-login trigger
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: "password123" })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        setWallet(data.wallet);
        showSuccess(`Authenticated Role Terminal: ${data.user.username} (${roleLabel})`);
      } else {
        setLoginErrorMsg(data.message);
      }
    } catch (err) {
      setLoginErrorMsg("Internal preset database link issue.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setWallet(null);
    setViewMode("landing");
    showSuccess("Workspace terminal disconnected. Session credentials cleared.");
  };

  // Expire Token Developer Test
  const corruptTokenSim = () => {
    // Generate an expired base64 token
    const payload = { id: user?.id || "usr-exp", username: user?.username || "expired_test", role: user?.role || "User", expiry: Date.now() - 5000 };
    const expiredToken = btoa(JSON.stringify(payload));
    setToken(expiredToken);
    localStorage.setItem(TOKEN_KEY, expiredToken);
    showSuccess("Auditor Test: Injected expired token payload.");
    addConsoleEntry(`COMPLIANCE_TEST: Expired authorization token payload generated to verify 401 Unauthorized handling.`);
  };

  // Helper additions
  const addConsoleEntry = (msg: string) => {
    const time = new Date().toLocaleTimeString("en-GB", { timeZone: "UTC" });
    setConsoleLogs(prev => [`[${time} UTC] ${msg}`, ...prev.slice(0, 15)]);
  };

  const showError = (text: string) => {
    setErrorNotification(text);
    setTimeout(() => {
      setErrorNotification(null);
    }, 5000);
  };

  const showSuccess = (text: string) => {
    setSuccessNotification(text);
    setTimeout(() => {
      setSuccessNotification(null);
    }, 5000);
  };

  return (
    <div id="finguard_applet" className="min-h-screen bg-[#0A0B0D] text-[#E0E0E0] font-sans antialiased text-sm transition-colors duration-300">
      
      {/* 1. TOAST NOTIFICATIONS */}
      <AnimatePresence>
        {errorNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            id="toast_error"
            className="fixed top-4 right-4 z-50 max-w-md p-4 bg-[#FF4D4D]/10 text-[#FF4D4D] rounded border border-[#FF4D4D]/30 shadow-[0_0_15px_rgba(255,77,77,0.15)] flex items-start gap-3 font-mono"
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 animate-bounce" />
            <div>
              <p className="font-bold text-sm uppercase tracking-wider">Compliance Exception Trigger</p>
              <p className="text-xs opacity-90">{errorNotification}</p>
            </div>
          </motion.div>
        )}

        {successNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            id="toast_success"
            className="fixed top-4 right-4 z-50 max-w-md p-4 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)] flex items-start gap-3 font-mono"
          >
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm uppercase tracking-wider">Platform Event Log</p>
              <p className="text-xs opacity-90">{successNotification}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. AUTHENTICATION GATE (IF NOT LOGGED IN) */}
      {!token ? (
        viewMode === "landing" ? (
          <div className="min-h-screen bg-[#0A0B0D] text-[#E0E0E0] font-sans flex flex-col selection:bg-emerald-500 selection:text-black">
            {/* Elegant Landing Navbar */}
            <header className="border-b border-[#1F232B] bg-[#0F1115]/85 backdrop-blur sticky top-0 z-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded font-bold text-black text-lg">
                    <Shield className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <span className="font-bold text-base text-white tracking-tight flex items-center gap-1.5 font-sans">
                      FinGuard Ledger Platform <span className="text-[9px] font-mono tracking-widest bg-[#1A1D23] border border-[#2D3139] text-emerald-400 px-1.5 py-0.5 rounded uppercase">ESN_v3</span>
                    </span>
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-6 text-xs text-[#8E9299]">
                  <a href="#features" className="hover:text-white transition-colors">Platform Modules</a>
                  <a href="#rbac-spec" className="hover:text-white transition-colors">Access Clearance Directory</a>
                  <a href="#telemetry-mock" className="hover:text-white transition-colors">Operations Engine Docs</a>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2 text-xs bg-[#15181E] px-3 py-1.5 rounded border border-[#1F232B]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-[#5C6370] font-mono font-bold tracking-wider text-[9px] uppercase">SECURE PROTOCOL ACTIVE</span>
                  </div>
                  <button 
                    onClick={() => setViewMode("auth")}
                    className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase tracking-wider rounded transition-all shadow-[0_0_10px_rgba(16,185,129,0.15)] flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Access Workspace</span>
                    <ArrowRightLeft className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </header>

            {/* Hero Splash Area */}
            <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-24">
              <div className="text-center space-y-6 max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-[10px] uppercase font-mono tracking-widest font-bold">
                  <Fingerprint className="w-3.5 h-3.5" /> Transaction Monitoring & Risk Mitigation System
                </div>
                
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans">
                  Enterprise Liquidity & <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                    Real-Time Settlement Engine
                  </span>
                </h1>

                <p className="text-sm text-[#8E9299] max-w-2xl mx-auto leading-relaxed">
                  FinGuard simulates corporate electronic wallet protocols, multi-party ledger processing, role privilege levels, cryptographically validated authorization streams, and core infrastructure monitoring curves. Built for institutional risk evaluation.
                </p>

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => setViewMode("auth")}
                    className="w-full sm:w-auto px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black text-xs uppercase tracking-wider font-bold rounded shadow-[0_0_15px_rgba(16,185,129,0.25)] flex items-center justify-center gap-2 transition-all cursor-pointer animate-pulse"
                  >
                    <Shield className="w-4.5 h-4.5" />
                    <span>Access Settlement Workspace</span>
                  </button>
                  <a
                    href="#features"
                    className="w-full sm:w-auto text-center px-8 py-3 bg-[#1A1D23] hover:bg-[#252A34] text-white text-xs uppercase tracking-wider font-bold rounded border border-[#2D3139] transition-all"
                  >
                    Platform Specifications
                  </a>
                </div>
              </div>

              {/* Live Mock Stats Panel */}
              <div id="telemetry-mock" className="bg-[#0F1115] border border-[#1F232B] rounded p-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center font-mono">
                <div>
                  <span className="text-[10px] text-[#5C6370] block uppercase tracking-wider mb-1">ACTIVE REPLICAS</span>
                  <span className="text-xl font-bold text-white">12 Sync Cores</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#5C6370] block uppercase tracking-wider mb-1">REPLICA SYNC RATE</span>
                  <span className="text-xl font-bold text-emerald-400">100.0% Realtime</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#5C6370] block uppercase tracking-wider mb-1">RISK MITIGATION</span>
                  <span className="text-xl font-bold text-white">Mitigation Engaged</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#5C6370] block uppercase tracking-wider mb-1">COMPLIANCE MONITOR</span>
                  <span className="text-xl font-bold text-emerald-400">SECURE GATEWAY ACTIVE</span>
                </div>
              </div>

              {/* Feature Bento Grid */}
              <div id="features" className="space-y-12">
                <div className="text-center space-y-2">
                  <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest text-[#5C6370]">Platform Core Modules</h2>
                  <p className="text-xl font-bold text-white tracking-tight">System Specifications & Institutional Modules</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Card 1: Token Inspector */}
                  <div className="bg-[#0F1115] border border-[#1F232B] p-6 rounded hover:border-[#2D3139] transition-all flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded flex items-center justify-center">
                        <Fingerprint className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Role Token Inspector</h3>
                      <p className="text-xs text-[#8E9299] leading-relaxed">
                        The session token auditor decodes auth claims in real-time. Review claims directly inside securely structured keys to check access role scopes. Simulate token lifecycle timeouts instantly to verify routing safety.
                      </p>
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1 bg-emerald-500/5 px-2 py-1 rounded w-fit border border-emerald-500/10">
                      ● Claims Auditor
                    </span>
                  </div>

                  {/* Card 2: Double-Entry Ledger */}
                  <div className="bg-[#0F1115] border border-[#1F232B] p-6 rounded hover:border-[#2D3139] transition-all flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded flex items-center justify-center">
                        <WalletIcon className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Double-Entry General Ledger</h3>
                      <p className="text-xs text-[#8E9299] leading-relaxed">
                        Monitor balances, transaction postings, and account mappings. Initiate realtime settlements from your terminal to target sandbox counterparties, recording results live onto the audit ledger.
                      </p>
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1 bg-emerald-500/5 px-2 py-1 rounded w-fit border border-emerald-500/10">
                      ● General Ledger Sync
                    </span>
                  </div>

                  {/* Card 3: Live Intrusion Alerts */}
                  <div className="bg-[#0F1115] border border-[#1F232B] p-6 rounded hover:border-[#2D3139] transition-all flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Compliance Hold & Risk Alerts</h3>
                      <p className="text-xs text-[#8E9299] leading-relaxed">
                        Flags anomalous settlements violating compliance parameters. Monitors reviewer queues under analyst privileges, allowing administrators to audit entries and execute policy overrides.
                      </p>
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1 bg-emerald-500/5 px-2 py-1 rounded w-fit border border-emerald-500/10">
                      ● Compliance Hold Engine
                    </span>
                  </div>

                  {/* Card 4: Hardware Telemetry */}
                  <div className="bg-[#0F1115] border border-[#1F232B] p-6 rounded hover:border-[#2D3139] transition-all flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded flex items-center justify-center">
                        <Activity className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Infrastructure Observability Monitor</h3>
                      <p className="text-xs text-[#8E9299] leading-relaxed">
                        Track and monitor computational loads, relational database IOPS, replication latencies, active adapter states, and system logs in an intuitive Operations Dashboard.
                      </p>
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1 bg-emerald-500/5 px-2 py-1 rounded w-fit border border-emerald-500/10">
                      ● Engine Metrics Stream
                    </span>
                  </div>
                </div>
              </div>

              {/* Security Levels Block */}
              <div id="rbac-spec" className="space-y-6">
                <div className="text-center space-y-1">
                  <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest text-[#5C6370]">Role Privilege Mapping</h2>
                  <p className="text-xl font-bold text-white tracking-tight">Access Control Directory</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#15181E] border border-[#1F232B] p-5 rounded space-y-2 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#5C6370]">Access Level 1</span>
                    <h4 className="text-sm font-bold text-white">Client Account</h4>
                    <p className="text-xs text-[#8E9299] leading-normal font-sans">
                      Query wallet status, initiate double-entry sandbox wires, and generate test liquidity.
                    </p>
                  </div>
                  <div className="bg-[#15181E] border border-[#1F232B] p-5 rounded space-y-2 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">Access Level 2</span>
                    <h4 className="text-sm font-bold text-white flex items-center justify-center gap-1.5"><Terminal className="w-4 h-4 text-emerald-400" /> Compliance Operator</h4>
                    <p className="text-xs text-[#8E9299] leading-normal font-sans">
                      Audit historical ledgers, monitor compliance exception events, and manage active risk holds.
                    </p>
                  </div>
                  <div className="bg-[#15181E] border-2 border-emerald-500/30 p-5 rounded shadow-[0_0_12px_rgba(16,185,129,0.05)] space-y-2 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">Access Level 3</span>
                    <h4 className="text-sm font-bold text-white flex items-center justify-center gap-1.5"><Shield className="w-4 h-4 text-emerald-400" /> Platform Administrator</h4>
                    <p className="text-xs text-[#8E9299] leading-normal font-sans">
                      Full access admin rights. Process held transactions, execute database resets, test capacity loads, and analyze automatic risk mitigations.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Conversion Area */}
              <div className="p-8 bg-gradient-to-r from-[#0F1115] to-[#15181E] border border-[#1F232B] rounded text-center space-y-4 max-w-2xl mx-auto">
                <h3 className="text-base font-bold text-white uppercase tracking-wider font-sans">Connect to the Settlement Workspace</h3>
                <p className="text-xs text-[#8E9299] max-w-md mx-auto leading-relaxed font-sans">
                  Authenticate with one of our enterprise-grade presets or register a custom role profile to access the live operations dashboard.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setViewMode("auth")}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs uppercase font-bold tracking-wider rounded transition-all shadow-[0_0_10px_rgba(16,185,129,0.15)] flex items-center gap-1.5 mx-auto cursor-pointer"
                  >
                    <span>Launch Workspace Terminal</span>
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-[#1F232B] bg-[#0F1115] py-8 text-center text-[10px] text-[#5C6370] font-mono">
              <p>© 2026 FinGuard Infrastructure Console. Engineered for enterprise risk demonstrating purposes. Simulation-only environment.</p>
            </footer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-6 bg-[#0F1115] p-8 rounded border border-[#1F232B] text-[#E0E0E0] shadow-2xl">
              
              <div className="flex justify-between items-center text-xs text-[#5C6370]">
                <button 
                  onClick={() => setViewMode("landing")} 
                  className="flex items-center gap-1 hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 rotate-180" /> Back to Overview
                </button>
              </div>

              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded text-black font-semibold mb-2">
                  <Shield className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-white font-sans">
                  FinGuard Secure Console Ingress
                </h2>
                <p className="text-xs text-[#8E9299] max-w-xs mx-auto">
                  High-fidelity secure gateway simulating corporate liquidity ledgers. Strictly authorized endpoints only.
                </p>
              </div>

              {/* PRESETS BUTTONS PANEL */}
              <div className="bg-[#1A1D23] p-4 rounded border border-[#2D3139] space-y-3">
                <span className="text-[10px] font-bold text-[#5C6370] uppercase tracking-widest block flex items-center gap-1">
                  <Fingerprint className="w-3.5 h-3.5" /> Role Presets (Instant Authenticate)
                </span>
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    type="button"
                    id="preset_btn_admin"
                    onClick={() => handlePresetLogin("admin_node", "System Admin Clearance Level-3")}
                    className="w-full flex items-center justify-between px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider rounded transition-all shadow-[0_0_8px_#10B981]/15 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Shield className="w-3.5 h-3.5" /> Treasury Admin Console
                    </span>
                    <span className="text-[10px] bg-black/30 text-emerald-300 px-1.5 py-0.5 rounded font-mono">admin_node</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      id="preset_btn_operator"
                      onClick={() => handlePresetLogin("analyst_ops", "Threat Analyst Clearance Level-2")}
                      className="flex items-center justify-between px-2.5 py-2 bg-[#15181E] hover:bg-[#1C2027] text-emerald-400 text-xs rounded border border-[#1F232B] transition-colors font-sans cursor-pointer"
                    >
                      <span className="flex items-center gap-1 font-semibold">
                        <Terminal className="w-3.5 h-3.5" /> Compliance Officer
                      </span>
                    </button>
                    <button 
                      type="button"
                      id="preset_btn_user"
                      onClick={() => handlePresetLogin("customer_zero", "Platform Customer Clearance Level-1")}
                      className="flex items-center justify-between px-2.5 py-2 bg-[#15181E] hover:bg-[#1C2027] text-[#8E9299] hover:text-white text-xs rounded border border-[#1F232B] transition-colors font-sans cursor-pointer"
                    >
                      <span className="flex items-center gap-1 font-semibold text-emerald-400">
                        <WalletIcon className="w-3.5 h-3.5" /> customer_zero
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-[#1F232B]"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#0F1115] px-3 text-[#5C6370] font-bold tracking-wider text-[10px]">
                    Or Custom Credentials
                  </span>
                </div>
              </div>

              <form className="space-y-4" onSubmit={isRegisterMode ? handleRegister : handleLogin}>
                <div>
                  <label className="block text-[10px] font-bold text-[#5C6370] uppercase tracking-widest mb-1">
                    Authorized Username
                  </label>
                  <input
                    type="text"
                    required
                    id="auth_input_username"
                    placeholder="e.g. corporate_client_01"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0B0D] border border-[#1F232B] focus:border-emerald-500 focus:ring-0 focus:outline-none rounded text-xs font-mono text-[#E0E0E0] placeholder:text-[#5C6370]"
                  />
                </div>

                {isRegisterMode && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-[#5C6370] uppercase tracking-widest mb-1">
                        Enterprise Email
                      </label>
                      <input
                        type="email"
                        required
                        id="auth_input_email"
                        placeholder="e.g. client@finguard.mock"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0A0B0D] border border-[#1F232B] focus:border-emerald-500 focus:ring-0 focus:outline-none rounded text-xs font-mono text-[#E0E0E0] placeholder:text-[#5C6370]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#5C6370] uppercase tracking-widest mb-1">
                        Federated Access Role
                      </label>
                      <select
                        id="auth_select_role"
                        value={roleInput}
                        onChange={(e) => setRoleInput(e.target.value as UserRole)}
                        className="w-full px-3 py-2 bg-[#0A0B0D] border border-[#1F232B] focus:border-emerald-500 focus:ring-0 focus:outline-none rounded text-xs text-[#E0E0E0]"
                      >
                        <option value="User" className="bg-[#0F1115]">Standard Mercantile (Level 1)</option>
                        <option value="Operator" className="bg-[#0F1115]">Compliance Operator (Level 2)</option>
                        <option value="Admin" className="bg-[#0F1115]">Platform Administrator (Level 3)</option>
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-[#5C6370] uppercase tracking-widest mb-1">
                    Security Access Key (Password)
                  </label>
                  <input
                    type="password"
                    required
                    id="auth_input_password"
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0B0D] border border-[#1F232B] focus:border-emerald-500 focus:ring-0 focus:outline-none rounded text-xs font-mono text-[#E0E0E0] placeholder:text-[#5C6370]"
                  />
                </div>

                {loginErrorMsg && (
                  <div id="login_error" className="p-2.5 bg-[#FF4D4D]/10 border border-[#FF4D4D]/25 text-[#FF4D4D] text-xs rounded flex items-center gap-2 font-mono">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{loginErrorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  id="auth_submit_btn"
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-black font-bold text-xs uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2 shadow-[0_0_8px_#10B981]/15 cursor-pointer"
                >
                  <Shield className="w-4 h-4" />
                  <span>{isRegisterMode ? "Register Account Credentials" : "Issue Authorization Token"}</span>
                </button>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  id="toggle_auth_mode"
                  onClick={() => {
                    setIsRegisterMode(!isRegisterMode);
                    setLoginErrorMsg("");
                    setUsernameInput("");
                    setEmailInput("");
                    setPasswordInput("");
                  }}
                  className="text-xs text-emerald-400 hover:text-emerald-350 font-semibold transition-colors cursor-pointer"
                >
                  {isRegisterMode ? "Already registered? Access existing terminal" : "Need workspace? Provision a new sandbox terminal"}
                </button>
              </div>

            </div>
          </div>
        )
      ) : (
        <div>
          
          {/* HEADER NAV SYSTEM */}
          <header className="bg-[#0F1115] border-b border-[#1F232B] sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                
                {/* Logo & Node Clearance */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded flex items-center justify-center font-bold text-black text-lg">
                    <Shield className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <span className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
                      FinGuard <span className="text-[10px] font-semibold font-mono tracking-widest bg-[#1A1D23] border border-[#2D3139] text-emerald-400 px-1.5 py-0.5 rounded uppercase">PRO_LEDGER</span>
                    </span>
                    <span className="text-[10px] text-[#5C6370] block -mt-1 font-mono uppercase tracking-wider">
                      Active Workspace Terminal: <span className="text-emerald-400 font-semibold">{user?.username}</span>
                    </span>
                  </div>
                </div>

                {/* Main Tabs Navigation */}
                <nav className="hidden md:flex items-center gap-1 bg-[#0A0B0D] p-1 rounded border border-[#1F232B]">
                  <button 
                    id="nav_tab_wallet"
                    onClick={() => setActiveTab("wallet")}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeTab === "wallet" 
                        ? "bg-[#1A1D23] text-emerald-400 border-l-2 border-emerald-400" 
                        : "text-[#8E9299] hover:bg-[#1A1D23] hover:text-[#E0E0E0]"
                    }`}
                  >
                    <WalletIcon className="w-3.5 h-3.5" /> Account Directory & Ledger
                  </button>

                  {user?.role !== "User" && (
                    <>
                      <button 
                        id="nav_tab_fraud"
                        onClick={() => setActiveTab("fraud")}
                        className={`px-3 py-1.5 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          activeTab === "fraud" 
                            ? "bg-[#1A1D23] text-emerald-400 border-l-2 border-emerald-400" 
                            : "text-[#8E9299] hover:bg-[#1A1D23] hover:text-[#E0E0E0]"
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-450 animate-pulse" /> 
                        <span>Risk Exceptions & Holds</span>
                        {alerts.filter(a => a.status === "OPEN").length > 0 && (
                          <span className="bg-amber-500 text-black text-[9px] font-bold px-1.5 rounded-full">
                            {alerts.filter(a => a.status === "OPEN").length}
                          </span>
                        )}
                      </button>

                      <button 
                        id="nav_tab_metrics"
                        onClick={() => setActiveTab("metrics")}
                        className={`px-3 py-1.5 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          activeTab === "metrics" 
                            ? "bg-[#1A1D23] text-emerald-400 border-l-2 border-emerald-400" 
                            : "text-[#8E9299] hover:bg-[#1A1D23] hover:text-[#E0E0E0]"
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5" /> Infrastructure Observability
                      </button>

                      <button 
                        id="nav_tab_audit"
                        onClick={() => setActiveTab("audit")}
                        className={`px-3 py-1.5 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          activeTab === "audit" 
                            ? "bg-[#1A1D23] text-emerald-400 border-l-2 border-emerald-400" 
                            : "text-[#8E9299] hover:bg-[#1A1D23] hover:text-[#E0E0E0]"
                        }`}
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> Compliance Audit Ledger
                      </button>
                    </>
                  )}
                </nav>

                {/* System Status Indicators & Logout */}
                <div className="flex items-center gap-3">
                  <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold font-mono rounded border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="uppercase text-[9px]">Gateway Stable</span>
                  </div>

                  <span className="text-[10px] px-2 py-1 bg-[#1A1D23] border border-[#2D3139] text-[#E0E0E0] font-bold font-mono rounded uppercase">
                    Authorization: {user?.role}
                  </span>

                  <button
                    id="header_logout_btn"
                    onClick={handleLogout}
                    className="p-1.5 text-[#8E9299] hover:text-white transition-colors"
                    title="Disconnect Terminal (Log out)"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>

              </div>
            </div>
            
            {/* Mobile Navigation Bar */}
            <div className="md:hidden bg-[#0F1115] px-4 py-2 flex items-center justify-between border-t border-[#1F232B]">
              <span className="text-[10px] font-bold text-[#5C6370] uppercase tracking-wider">WORKSPACE MENU:</span>
              <div className="flex gap-1 overflow-x-auto max-w-[240px]">
                <button 
                  onClick={() => setActiveTab("wallet")}
                  className={`px-2 py-1 text-[11px] font-semibold rounded ${activeTab === "wallet" ? "bg-[#1A1D23] text-emerald-400 border-l-2 border-emerald-400" : "text-[#8E9299]"}`}
                >
                  Ledger Directory
                </button>
                
                {user?.role !== "User" && (
                  <>
                    <button 
                      onClick={() => setActiveTab("fraud")}
                      className={`px-2 py-1 text-[11px] font-semibold rounded ${activeTab === "fraud" ? "bg-[#1A1D23] text-emerald-400 border-l-2 border-emerald-400" : "text-[#8E9299]"}`}
                    >
                      Hold Queue ({alerts.filter(a => a.status === "OPEN").length})
                    </button>
                    <button 
                      onClick={() => setActiveTab("metrics")}
                      className={`px-2 py-1 text-[11px] font-semibold rounded ${activeTab === "metrics" ? "bg-[#1A1D23] text-emerald-400 border-l-2 border-emerald-400" : "text-[#8E9299]"}`}
                    >
                      Observability
                    </button>
                    <button 
                      onClick={() => setActiveTab("audit")}
                      className={`px-2 py-1 text-[11px] font-semibold rounded ${activeTab === "audit" ? "bg-[#1A1D23] text-emerald-400 border-l-2 border-emerald-400" : "text-[#8E9299]"}`}
                    >
                      Audit
                    </button>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* MAIN CONTAINER */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              
              {/* THE ENFORCEMENT RAIL (Left Info Column, 1 part) */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* Visual Identity / Token Inspector */}
                <div className="bg-[#0F1115] border border-[#1F232B] p-5 rounded space-y-4 shadow-none">
                  <div className="flex items-center justify-between border-b border-[#1F232B] pb-3">
                    <span className="text-[10px] uppercase tracking-widest text-[#5C6370] font-bold block flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" /> Authorization Token Auditor
                    </span>
                    <button 
                      onClick={fetchAllData}
                      className="p-1 text-[#8E9299] hover:text-white"
                      disabled={isSyncing}
                      title="Sync data"
                    >
                      <RefreshCw className={`w-3 px-0 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <p className="text-[11px] text-[#8E9299] leading-normal mb-2 font-mono">
                    View the active session token injected into RPC headers. Expire the signature to verify 401 Unauthorized handling.
                  </p>

                  <div className="space-y-3 font-mono text-[10px]">
                    <div>
                      <span className="text-[9px] uppercase tracking-widest text-[#5C6370] block font-semibold mb-0.5">JWT HEADER</span>
                      <pre className="p-2.5 bg-[#0A0B0D] border border-[#1F232B] text-cyan-400 rounded overflow-x-auto select-all max-h-[80px]">
                        {jwtHeader}
                      </pre>
                    </div>

                    <div>
                      <span className="text-[9px] uppercase tracking-widest text-[#5C6370] block font-semibold mb-0.5">DECODED CLAIMS PAYLOAD</span>
                      <pre className="p-2.5 bg-[#0A0B0D] border border-[#1F232B] text-emerald-400 rounded overflow-x-auto select-all max-h-[140px]">
                        {jwtPayload}
                      </pre>
                    </div>

                    <div>
                      <span className="text-[9px] uppercase tracking-widest text-[#5C6370] block font-semibold mb-0.5">VERIFIED TOKEN SIGNATURE</span>
                      <p className="p-2 bg-[#0A0B0D] border border-[#1F232B] text-[#FF4D4D] rounded overflow-x-auto select-all truncate">
                        {jwtSignature}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      id="corrupt_token_btn"
                      onClick={corruptTokenSim}
                      className="w-full text-center py-2 px-3 bg-[#FF4D4D]/5 hover:bg-[#FF4D4D]/10 border border-[#FF4D4D]/20 text-[#FF4D4D] rounded font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Simulate 401 Expiry (Test Security)
                    </button>
                  </div>
                </div>

                {/* Simulated RBAC Roles Map */}
                <div className="bg-[#0F1115] border border-[#1F232B] p-5 rounded space-y-4 shadow-none">
                  <span className="text-[10px] uppercase tracking-widest text-[#5C6370] font-bold block flex items-center gap-1.5 border-b border-[#1F232B] pb-3">
                    <Users className="w-3.5 h-3.5 text-emerald-400" /> Role Privilege Mapping
                  </span>
                  
                  <div className="space-y-2 text-xs">
                    <div className={`p-2 rounded border flex items-center justify-between ${user?.role === "Admin" ? "bg-[#1A1D23] border-[#2D3139] text-emerald-400 font-semibold" : "bg-transparent border-[#1F232B] text-[#5C6370]"}`}>
                      <div className="flex items-center gap-1.5 leading-none">
                        <Shield className="w-3.5 h-3.5" />
                        <div>
                          <p className="font-bold text-[11px]">Level 3: Platform Administrator</p>
                          <p className="text-[9px] opacity-85 mt-0.5 font-mono">Authorize overrides, inspect security audit trailing</p>
                        </div>
                      </div>
                      {user?.role === "Admin" ? <Unlock className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3 opacity-60" />}
                    </div>

                    <div className={`p-2 rounded border flex items-center justify-between ${user?.role === "Operator" ? "bg-[#1A1D23] border-[#2D3139] text-emerald-400 font-semibold" : "bg-transparent border-[#1F232B] text-[#5C6370]"}`}>
                      <div className="flex items-center gap-1.5 leading-none">
                        <Terminal className="w-3.5 h-3.5" />
                        <div>
                          <p className="font-bold text-[11px]">Level 2: Compliance Operator</p>
                          <p className="text-[9px] opacity-85 mt-0.5 font-mono">Review queue files, audit compliance metrics</p>
                        </div>
                      </div>
                      {user?.role === "Operator" ? <Unlock className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3 opacity-60" />}
                    </div>

                    <div className={`p-2 rounded border flex items-center justify-between ${user?.role === "User" ? "bg-[#1A1D23] border-[#2D3139] text-emerald-400 font-semibold" : "bg-transparent border-[#1F232B] text-[#5C6370]"}`}>
                      <div className="flex items-center gap-1.5 leading-none">
                        <WalletIcon className="w-3.5 h-3.5" />
                        <div>
                          <p className="font-bold text-[11px]">Level 1: Client Account</p>
                          <p className="text-[9px] opacity-85 mt-0.5 font-mono">Execute sandbox wires, generate liquidity</p>
                        </div>
                      </div>
                      {user?.role === "User" ? <Unlock className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3 opacity-60" />}
                    </div>
                  </div>
                </div>

                {/* Sandbox Faucet Panel */}
                <div className="bg-[#0F1115] border border-[#1F232B] p-5 rounded space-y-3 shadow-none">
                  <span className="text-[10px] uppercase tracking-widest text-[#5C6370] font-bold block flex items-center gap-1.5 border-b border-[#1F232B] pb-3">
                    <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Capital Sandbox Faucet
                  </span>
                  
                  <div className="space-y-3">
                    <p className="text-[11px] text-[#8E9299]">
                      Generate test liquidity up to $100,000 to fund your sandbox merchant wallet instantly.
                    </p>

                    <div>
                      <select 
                        value={faucetAmount} 
                        onChange={(e) => setFaucetAmount(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0A0B0D] border border-[#1F232B] rounded text-xs text-white"
                      >
                        <option value="1000">+$1,000 Test Liquidity</option>
                        <option value="10000">+$10,000 Test Liquidity</option>
                        <option value="50000">+$50,000 Test Liquidity</option>
                        <option value="100000">+$100,000 Test Liquidity</option>
                      </select>
                    </div>

                    <button 
                      onClick={handleFaucet}
                      disabled={isFauceting}
                      id="faucet_fund_btn"
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase text-[10px] tracking-wider rounded transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 shadow-[0_0_8px_#10B981]/15"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isFauceting ? 'animate-spin' : ''}`} />
                      <span>{isFauceting ? "Generating liquidity..." : "Approve liquidity injection"}</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* DYNAMIC SCREEN TILES WORKSPACE (Right 3 Columns) */}
              <div className="lg:col-span-3 space-y-8">

                {/* 3A. WALLET & TRANSFER WORKSPACE */}
                {activeTab === "wallet" && (
                  <div className="space-y-8">
                    
                    {/* Balanced Ledger Card */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      <div className="md:col-span-2 bg-[#0F1115] text-[#E0E0E0] p-6 rounded border border-[#1F232B] relative overflow-hidden flex flex-col justify-between h-48">
                        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl"></div>
                        
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-mono tracking-widest text-[#5C6370] uppercase block">GL SYSTEM LINKED</span>
                            <span className="text-xs text-emerald-400 font-semibold font-mono block mt-1 font-sans">FG-WL-SYS-{wallet?.accountNumber || "EMPTY"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#1A1D23] border border-[#2D3139] text-[#8E9299] font-mono text-[9px] rounded">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>AUDIT LEDGER</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-[#5C6370] uppercase block font-mono">CURRENT MERCH BALANCE (USD)</span>
                          <span className="text-3xl font-extrabold tracking-tight block mt-1 text-white font-mono">
                            ${wallet?.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between border-t border-[#1F232B] pt-3">
                          <span className="text-[10px] font-mono text-[#8E9299]">ROUTING CODE: <span className="font-bold text-emerald-400">{wallet?.routingCode}</span></span>
                          <span className="text-[10px] font-mono text-[#5C6370] uppercase">SANDBOX SETTLEMENT ACTIVE</span>
                        </div>
                      </div>

                      <div className="bg-[#0F1115] p-6 rounded border border-[#1F232B] flex flex-col justify-between h-48 shadow-none">
                        <span className="text-[10px] font-bold text-[#5C6370] uppercase tracking-widest block flex items-center gap-1.5 border-b border-[#1F232B] pb-2">
                          <Globe className="w-4 h-4 text-emerald-400" /> Settlement Account Directory
                        </span>
                        
                        <div className="space-y-2 h-[80px] overflow-y-auto pr-1">
                          {walletsDirectory.length === 0 ? (
                            <span className="text-xs text-[#5C6370] font-mono block">Querying directory records...</span>
                          ) : (
                            walletsDirectory.map((w, index) => (
                              <button 
                                key={index}
                                type="button"
                                onClick={() => setTargetWalletNum(w.accountNumber)}
                                className={`w-full flex items-center justify-between p-1 px-1.5 rounded text-left transition-colors font-mono text-[11px] ${targetWalletNum === w.accountNumber ? 'bg-[#1A1D23] border border-[#2D3139] text-emerald-400 font-bold' : 'hover:bg-[#1A1D23]/50 text-[#8E9299]'}`}
                              >
                                <span>{w.username === user?.username ? 'Your Node' : w.username}</span>
                                <span>{w.accountNumber}</span>
                              </button>
                            ))
                          )}
                        </div>

                        <p className="text-[9px] text-[#5C6370] font-mono border-t border-[#1F232B] pt-2 text-right">
                          Click row entry to select target account number.
                        </p>
                      </div>

                    </div>

                    {/* Double-Entry Ledger Transfer form */}
                    <div className="bg-[#0F1115] p-6 rounded border border-[#1F232B] space-y-6 shadow-none">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-white font-sans flex items-center gap-2">
                          <ArrowRightLeft className="w-4.5 h-4.5 text-emerald-450" />
                          <span>Initiate Sandbox Wire Transfer</span>
                        </h3>
                        <p className="text-xs text-[#8E9299]">
                          Initiate real-time double-entry settlement wires between system entities. The Risk Mitigation Engine will evaluate transaction profiles.
                        </p>
                      </div>

                      <form onSubmit={handleTransfer} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-[#5C6370] uppercase tracking-widest mb-1.5">
                              Beneficiary Account Number (FG-WL-XXXXX)
                            </label>
                            <input
                              type="text"
                              required
                              id="transfer_input_account"
                              placeholder="Select directory account or specify number (e.g. FG-WL-20098)"
                              value={targetWalletNum}
                              onChange={(e) => setTargetWalletNum(e.target.value)}
                              className="w-full px-3 py-2 bg-[#0A0B0D] border border-[#1F232B] focus:border-emerald-500 focus:ring-0 focus:outline-none rounded text-xs font-mono text-[#E0E0E0] placeholder:text-[#5C6370]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-[#5C6370] uppercase tracking-widest mb-1.5">
                              Transfer Volume (USD Equivalent)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-[#5C6370] font-mono text-xs">$</span>
                              <input
                                  type="number"
                                  required
                                  min="1"
                                  id="transfer_input_amount"
                                  placeholder="A transfer volume of > $5,000 triggers an automated compliance hold."
                                  value={transferAmount}
                                  onChange={(e) => setTransferAmount(e.target.value)}
                                  className="w-full pl-7 pr-3 py-2 bg-[#0A0B0D] border border-[#1F232B] focus:border-emerald-500 focus:ring-0 focus:outline-none rounded text-xs font-mono text-[#E0E0E0] placeholder:text-[#5C6370]"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-[#5C6370] uppercase tracking-widest mb-1.5">
                            Payment Reference & Memo
                          </label>
                          <input
                            type="text"
                            id="transfer_input_notes"
                            placeholder="e.g. Global trade invoice settlement"
                            value={transferNotes}
                            onChange={(e) => setTransferNotes(e.target.value)}
                            className="w-full px-3 py-2 bg-[#0A0B0D] border border-[#1F232B] focus:border-emerald-500 focus:ring-0 focus:outline-none rounded text-xs text-[#E0E0E0] placeholder:text-[#5C6370]"
                          />
                          <p className="text-[10px] text-[#5C6370] mt-1 font-mono">
                            Tip: Payment memo keywords such as **"Urgent"**, **"Escalation"**, or **"Arbitrage"** affect calculated Transaction Risk Scores.
                          </p>
                        </div>

                        {transferMessage && (
                          <div id="transfer_status_box" className={`p-3 rounded border text-xs flex items-start gap-2 font-mono ${
                            transferMessage.type === "success" 
                              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-450" 
                              : transferMessage.type === "warn"
                              ? "bg-amber-500/10 border-amber-500/25 text-amber-500"
                              : "bg-[#FF4D4D]/10 border-[#FF4D4D]/25 text-[#FF4D4D]"
                          }`}>
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold uppercase tracking-wider">{transferMessage.type === "success" ? "TRANSACTION SETTLED" : transferMessage.type === "warn" ? "COMPLIANCE EXCEPTION HOLD" : "TRANSACTION REJECTED"}</p>
                              <p className="opacity-90">{transferMessage.text}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            id="transfer_submit_btn"
                            disabled={isSubmittingTransfer}
                            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase text-[10px] tracking-wider rounded transition-colors flex items-center gap-1.5 shadow-[0_0_8px_#10B981]/15"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                            <span>{isSubmittingTransfer ? "Executing ledger math..." : "Submit Settlement Wire"}</span>
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Historical Activity log stream (Clean transaction table) */}
                    <div className="bg-[#0F1115] p-6 rounded border border-[#1F232B] space-y-4 shadow-none">
                      <div className="flex items-center justify-between border-b border-[#1F232B] pb-3">
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wider text-white font-sans flex items-center gap-2">
                            <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-450" />
                            <span>Double-Entry Audit Journal</span>
                          </h3>
                          <p className="text-xs text-[#8E9299]">
                            Institutional record of double-entry historical transactions captured within current session memory.
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-[#1F232B] pb-2 text-[10px] font-bold text-[#5C6370] uppercase tracking-widest">
                              <th className="py-3 px-2">Transaction ID</th>
                              <th className="py-3 px-2">Routing Route (De/Cr)</th>
                              <th className="py-3 px-2 text-right">Amount (USD)</th>
                              <th className="py-3 px-2">Risk Score</th>
                              <th className="py-3 px-2 text-center">Status</th>
                              <th className="py-3 px-2 text-right">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1F232B] font-mono text-xs">
                            {transactions.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-4 text-center text-[#5C6370] font-mono">
                                  No verified transaction records exist in memory ledgers yet.
                                </td>
                              </tr>
                            ) : (
                              transactions.map((tx) => (
                                <tr 
                                  key={tx.id} 
                                  id={`tx_row_${tx.id}`}
                                  className="hover:bg-[#1A1D23]/40 cursor-pointer transition-colors"
                                  onClick={() => setSelectedTx(tx)}
                                >
                                  <td className="py-2.5 px-2 font-mono font-bold text-emerald-400">
                                    {tx.auditRef}
                                  </td>
                                  <td className="py-2.5 px-2 text-[#E0E0E0]">
                                    <span className="font-semibold block text-white">{tx.senderName === user?.username ? "You" : tx.senderName}</span>
                                    <span className="text-[10px] text-[#8E9299] block -mt-0.5 font-mono">→ {tx.receiverName === user?.username ? "You" : tx.receiverName}</span>
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-mono font-bold text-white">
                                    ${tx.amount.toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-2">
                                    <div className="flex items-center gap-1 font-mono text-[10px]">
                                      <span className={`w-1.5 h-1.5 rounded-full ${tx.fraudRiskScore >= 75 ? 'bg-[#FF4D4D] animate-pulse' : tx.fraudRiskScore >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                                      <span className={tx.fraudRiskScore >= 75 ? 'text-[#FF4D4D]' : 'text-[#8E9299]'}>{tx.fraudRiskScore}% Risk</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-2 text-center font-mono">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-block ${
                                      tx.status === "SETTLED" 
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                        : tx.status === "HELD"
                                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse"
                                        : "bg-[#FF4D4D]/10 text-[#FF4D4D] border border-red-500/20"
                                    }`}>
                                      {tx.status}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-2 text-right text-[10px] text-[#5C6370] font-mono">
                                    {new Date(tx.createdAt).toLocaleTimeString()}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}

                {/* 3B. COMPLIANCE SUSPICIOUS ALERTS */}
                {activeTab === "fraud" && user?.role !== "User" && (
                  <div className="space-y-8">
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white font-sans flex items-center gap-2">
                          <AlertTriangle className="text-amber-500 w-5 h-5 animate-pulse" />
                          <span>Transaction Hold Queue & Compliance Center</span>
                        </h2>
                        <p className="text-xs text-[#8E9299] max-w-xl">
                          Review transaction holds flagged by automated risk rules. Authorized administrators can issue direct settlement override releases to approve held funds.
                        </p>
                      </div>

                      <div className="px-3 py-1.5 bg-[#1A1D23] border border-[#2D3139] text-amber-400 font-mono text-xs rounded uppercase flex items-center gap-1.5 font-bold">
                        <span>OPEN_RISK_HOLDS:</span>
                        <span>{alerts.filter(a => a.status === "OPEN").length}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {alerts.length === 0 ? (
                        <div className="col-span-2 bg-[#0F1115] p-12 text-center text-[#5C6370] rounded border border-[#1F232B] font-mono">
                          Zero outstanding compliance exception holds reported. Platform operates within normal transaction risk parameters.
                        </div>
                      ) : (
                        alerts.map((alert) => (
                          <div 
                            key={alert.id} 
                            id={`alert_card_${alert.id}`}
                            className={`p-6 rounded border transition-colors relative flex flex-col justify-between ${
                              alert.status === "OPEN" 
                                ? "bg-[#0F1115] border-amber-500/30 text-[#E0E0E0]" 
                                : "bg-[#0F1115] border-[#1F232B] opacity-60 text-[#8E9299]"
                            }`}
                          >
                            <div className="flex items-start justify-between border-b border-[#1F232B] pb-3 mb-4">
                              <div>
                                <span className="text-[10px] font-mono tracking-wider font-bold uppercase block text-[#5C6370] leading-none">EXCEPTION FLAG ID</span>
                                <span className="font-mono text-xs font-bold text-emerald-400 block mt-1">{alert.id}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                alert.status === "OPEN" 
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse" 
                                  : "bg-[#1A1D23] text-[#5C6370] border border-[#2D3139]"
                              }`}>
                                {alert.status}
                              </span>
                            </div>

                            <div className="space-y-3 font-sans text-xs">
                              <div>
                                <span className="text-[#5C6370] uppercase tracking-widest text-[9px] font-mono block mb-0.5">Automated Hold Trigger Description</span>
                                <p className="font-medium font-mono text-[#E0E0E0]">{alert.triggerReason}</p>
                              </div>

                              <div className="grid grid-cols-2 gap-2 my-2 bg-[#0A0B0D] p-2.5 rounded border border-[#1F232B] font-mono text-[11px]">
                                <div>
                                  <span className="text-[#5C6370] text-[9px] block">Source Account</span>
                                  <span className="font-bold text-[#E0E0E0]">{alert.senderName}</span>
                                </div>
                                <div>
                                  <span className="text-[#5C6370] text-[9px] block">Destination Account</span>
                                  <span className="font-bold text-[#E0E0E0]">{alert.receiverName}</span>
                                </div>
                                <div className="mt-1">
                                  <span className="text-[#5C6370] text-[9px] block font-semibold">Transaction Volume</span>
                                  <span className="font-bold text-amber-500">${alert.amount.toLocaleString()}</span>
                                </div>
                                <div className="mt-1">
                                  <span className="text-[#5C6370] text-[9px] block">Exception Detected</span>
                                  <span className="text-[#8E9299]">{new Date(alert.createdAt).toLocaleTimeString()}</span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-[#1F232B]">
                              {alert.status === "OPEN" ? (
                                user?.role === "Admin" ? (
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      id={`alert_reject_btn_${alert.id}`}
                                      onClick={() => handleResolveAlert(alert.id, "REJECT")}
                                      className="px-3 py-1.5 bg-[#FF4D4D]/10 hover:bg-[#FF4D4D]/20 border border-[#FF4D4D]/25 text-[#FF4D4D] font-bold font-mono text-[10px] rounded uppercase tracking-wider transition-colors"
                                    >
                                      Void & Recall Funds
                                    </button>
                                    <button
                                      id={`alert_approve_btn_${alert.id}`}
                                      onClick={() => handleResolveAlert(alert.id, "APPROVE")}
                                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-sans text-[10px] rounded uppercase tracking-wider transition-colors shadow-[0_0_8px_#10B981]/15"
                                    >
                                      Approve Override (Settle Funds)
                                    </button>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-amber-500 font-bold font-mono text-right uppercase">
                                    Operator level read-only access. Administrator authorization required to override compliance holds.
                                  </p>
                                )
                              ) : (
                                <p className="text-[10px] text-slate-400 font-bold font-mono text-right uppercase">
                                  Resolved.
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                  </div>
                )}

                {/* 3C. HARDWARE TELEMETRY WORKSPACE */}
                {activeTab === "metrics" && user?.role !== "User" && (
                  <div className="space-y-8">
                    
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-white font-sans flex items-center gap-2">
                        <Activity className="text-emerald-450 w-5 h-5" />
                        <span>Infrastructure Observability Panel</span>
                      </h2>
                      <p className="text-xs text-[#8E9299] max-w-xl">
                        Monitor live database transaction processing, processor workload statistics, queue thresholds, and replica synchronization states. Updated in real-time.
                      </p>
                    </div>

                    {/* Numeric Indicators */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      
                      <div className="bg-[#0F1115] p-4 rounded border border-[#1F232B]">
                        <span className="text-[#5C6370] text-[10px] font-mono block uppercase">PROCESSOR WORKLOAD</span>
                        <span id="metric_cpu" className="text-2xl font-bold font-mono block mt-1 text-white">{metrics?.cpuUsage || 0}%</span>
                        <div className="w-full bg-[#0A0B0D] rounded h-1 mt-2 overflow-hidden">
                          <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${metrics?.cpuUsage || 0}%` }}></div>
                        </div>
                      </div>

                      <div className="bg-[#0F1115] p-4 rounded border border-[#1F232B]">
                        <span className="text-[#5C6370] text-[10px] font-mono block uppercase">REPLICA SYNCHRONIZATION DELAY</span>
                        <span id="metric_delay" className="text-2xl font-bold font-mono block mt-1 text-emerald-400">{metrics?.replicaDelayMs || 0} ms</span>
                        <span className="text-[9px] text-emerald-500 font-mono block mt-1">✓ HIGH AVAILABILITY DEPLOYED</span>
                      </div>

                      <div className="bg-[#0F1115] p-4 rounded border border-[#1F232B]">
                        <span className="text-[#5C6370] text-[10px] font-mono block uppercase">GATEWAY PROTOCOL SECURED</span>
                        <span id="metric_status" className={`text-xl font-bold font-mono block mt-1 uppercase ${metrics?.secureChannelStatus === "HEALTHY" ? "text-emerald-400" : "text-amber-500"}`}>
                          {metrics?.secureChannelStatus}
                        </span>
                        <span className="text-[9px] text-[#5C6370] block -mt-1 font-mono uppercase">RISK CRITERIA: ARMED</span>
                      </div>

                      <div className="bg-[#0F1115] p-4 rounded border border-[#1F232B]">
                        <span className="text-[#5C6370] text-[10px] font-mono block uppercase">RESTRICTED ENDPOINT ADAPTERS</span>
                        <span id="metric_blocked_ips" className="text-2xl font-bold font-mono text-[#FF4D4D] block mt-1">{metrics?.blockedIPsCount || 0} ADAPTERS</span>
                        <span className="text-[9px] text-[#5C6370] font-mono block mt-1">{metrics?.bruteForceAttempts || 0} Connection rate flags detected</span>
                      </div>

                    </div>

                    {/* SVG Telemetry Visualizer Chart */}
                    <div className="bg-[#0F1115] p-6 rounded border border-[#1F232B] space-y-4 shadow-none">
                      <div className="flex items-center justify-between border-b border-[#1F232B] pb-3">
                        <h3 className="text-[10px] font-bold block uppercase tracking-widest text-[#8E9299] flex items-center gap-1.5">
                          <Database className="w-4 h-4 text-emerald-450" /> Transaction Database Processing Load (Last 10 intervals)
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 bg-[#1A1D23] border border-[#2D3139] text-[#8E9299] font-mono rounded">
                          ACTIVE DATABASE PERFORMANCE
                        </span>
                      </div>

                      {/* Custom Simulated Bar metrics chart */}
                      <div className="h-40 flex items-end justify-between gap-2 bg-[#0A0B0D] p-4 rounded border border-[#1F232B]">
                        {[45, 62, 55, 38, 71, 54, 49, 66, 52, Math.floor(40 + Math.random() * 30)].map((val, idx) => (
                          <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end">
                            <span className="text-[9px] font-mono text-[#5C6370] mb-1">{val}%</span>
                            <div className="w-full bg-[#1A1D23] rounded-t h-full flex flex-col justify-end">
                              <motion.div 
                                className={`w-full rounded-t ${val > 68 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ height: `${val}%` }}
                                initial={{ scaleY: 0 }}
                                animate={{ scaleY: 1 }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                            <span className="text-[9px] font-mono text-[#5C6370] mt-1">T-{10 - idx}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Real-time Streaming console console */}
                    <div className="bg-[#0F1115] p-6 rounded border border-[#1F232B] space-y-3 shadow-none">
                      <span className="text-[10px] font-bold text-[#8E9299] uppercase tracking-widest block flex items-center gap-1.5 pb-2 border-b border-[#1F232B]">
                        <Terminal className="w-4 h-4 text-emerald-450" /> Authorized Compliance Operations Event Stream
                      </span>

                      <div className="bg-[#0A0B0D] text-[#E0E0E0] p-4 rounded font-mono text-xs overflow-y-auto max-h-[180px] space-y-1 select-all border border-[#1F232B] shadow-inner">
                        {consoleLogs.map((logStr, index) => (
                          <div key={index} className="flex items-start gap-1">
                            <span className="text-emerald-500 select-none">&gt;</span>
                            <span className={`${logStr.includes("SECURITY") ? 'text-amber-500' : logStr.includes("LEDGER") ? 'text-emerald-400' : 'text-[#8E9299]'}`}>{logStr}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}

                {/* 3D. SECURE AUDIT LOG */}
                {activeTab === "audit" && user?.role !== "User" && (
                  <div className="space-y-4">
                    
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-white font-sans flex items-center gap-2">
                        <FileSpreadsheet className="text-emerald-450 w-5 h-5" />
                        <span>Institutional Compliance Audit Ledger</span>
                      </h2>
                      <p className="text-xs text-[#8E9299] max-w-xl">
                        Review chronological operational system event records, administrative actions, login authorizations, and transaction compliance updates.
                      </p>
                    </div>

                    <div className="bg-[#0F1115] p-6 rounded border border-[#1F232B] shadow-none">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-[#1F232B] text-[10px] font-bold text-[#5C6370] uppercase tracking-widest py-2">
                              <th className="py-3 px-2">Timestamp (UTC)</th>
                              <th className="py-3 px-2">Initiator Key</th>
                              <th className="py-3 px-2">Source IP</th>
                              <th className="py-3 px-2">Event Categorization</th>
                              <th className="py-3 px-2">Compliance Event Log</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1F232B] font-mono text-xs">
                            {logs.map((log) => (
                              <tr key={log.id} className="hover:bg-[#1A1D23]/50 font-mono text-xs text-[#E0E0E0]">
                                <td className="py-3 px-2 text-[#5C6370] text-[10px]">
                                  {new Date(log.createdAt).toLocaleString()}
                                </td>
                                <td className="py-3 px-2 font-bold text-white">
                                  {log.performedBy}
                                </td>
                                <td className="py-3 px-2 text-[#8E9299]">
                                  {log.ipAddress}
                                </td>
                                <td className="py-3 px-2">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    log.action.includes("SECURITY") || log.action.includes("ALERT")
                                      ? "bg-[#FF4D4D]/10 text-[#FF4D4D] border border-red-500/20" 
                                      : log.action.includes("LEDGER") 
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                      : "bg-[#1A1D23] text-[#5C6370] border border-[#2D3139]"
                                  }`}>
                                    {log.action}
                                  </span>
                                </td>
                                <td className="py-3 px-2 text-[#8E9299]">
                                  {log.details}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}

              </div>

            </div>
          </main>
          
        </div>
      )}

      {/* 4. TRANSACTION DETAIL MODAL OVERLAY */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              id="tx_detail_modal"
              className="bg-[#0F1115] p-6 rounded border border-[#1F232B] max-w-lg w-full space-y-4 shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-[#1F232B] pb-3">
                <span className="text-[10px] font-bold font-mono tracking-widest uppercase text-[#5C6370]">Settlement Ledger Document</span>
                <button onClick={() => setSelectedTx(null)} className="text-[#5C6370] hover:text-[#E0E0E0] transition-colors">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[#5C6370] text-xs font-mono">Entry ID Ref:</span>
                  <span className="font-mono font-bold text-emerald-400 select-all">{selectedTx.auditRef}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-[#0A0B0D] p-4 rounded border border-[#1F232B] font-mono text-xs">
                  <div>
                    <span className="text-[#5C6370] block text-[10px]">DEBIT ROUTING PATH (SENDER)</span>
                    <span className="font-bold block mt-0.5 text-white">{selectedTx.senderName}</span>
                    <span className="text-[10px] text-[#8E9299] mt-0.5 block">{selectedTx.sourceWalletId}</span>
                  </div>
                  <div>
                    <span className="text-[#5C6370] block text-[10px]">CREDIT ROUTING PATH (RECEIVER)</span>
                    <span className="font-bold block mt-0.5 text-white">{selectedTx.receiverName}</span>
                    <span className="text-[10px] text-[#8E9299] mt-0.5 block">{selectedTx.destWalletId}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-b border-[#1F232B] py-3 font-mono">
                  <span className="text-[#5C6370] text-xs uppercase font-sans">Gross Settlement Amount:</span>
                  <span className="text-xl font-extrabold text-[#E0E0E0]">${selectedTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="text-xs space-y-1 font-mono">
                  <span className="text-[#5C6370] uppercase tracking-widest text-[9px] font-bold block">Risk Engine System Analysis Signature</span>
                  <p className="bg-[#0A0B0D] p-2.5 rounded border border-[#1F232B] font-mono text-xs text-[#8E9299] leading-normal whitespace-pre-wrap">
                    {JSON.stringify({
                      calculatedRiskScore: `${selectedTx.fraudRiskScore}%`,
                      settlementStatus: selectedTx.status,
                      reconciliationStatus: "VERIFIED",
                      referenceHash: `FG_HASH_${btoa(selectedTx.id).slice(0, 15)}`,
                      originatingEndpoint: "127.18.25.109"
                    }, null, 2)}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button 
                  onClick={() => setSelectedTx(null)} 
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-sans text-[10px] rounded uppercase tracking-wider transition-colors shadow-[0_0_8px_#10B981]/15"
                >
                  Close Audit Sheet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
