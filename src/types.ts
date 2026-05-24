/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'User' | 'Operator' | 'Admin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Wallet {
  id: string;
  userId: string;
  accountNumber: string;
  balance: number;
  routingCode: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  sourceWalletId: string;
  destWalletId: string;
  amount: number;
  type: 'TRANSFER' | 'DEPOSIT' | 'WITHDRAWAL';
  status: 'SETTLED' | 'HELD' | 'REJECTED';
  fraudRiskScore: number;
  auditRef: string;
  notes?: string;
  senderName: string;
  receiverName: string;
  createdAt: string;
}

export interface FraudAlert {
  id: string;
  transactionId: string;
  triggerReason: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'RESOLVED' | 'RESOLVED_DENIED';
  createdAt: string;
  amount: number;
  senderName: string;
  receiverName: string;
}

export interface AuditLog {
  id: string;
  performedBy: string;
  ipAddress: string;
  action: string;
  details: string;
  createdAt: string;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  requestRate: number;
  activeConnections: number;
  replicaDelayMs: number;
  transactionPoolSize: number;
  secureChannelStatus: 'HEALTHY' | 'STRESSED' | 'ALERT';
  bruteForceAttempts: number;
  blockedIPsCount: number;
}
