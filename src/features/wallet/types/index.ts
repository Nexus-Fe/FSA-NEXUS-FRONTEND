export type WalletBalance = {
  walletId: string;
  userId: string;
  balance: number;
  availableBalance: number;
  lockedBalance: number;
  currency: string;
  status: string;
  updatedAt: string;
};

export type WalletTransaction = {
  id: string;
  amount: number;
  type: "DEPOSIT" | "PAYMENT" | "REFUND" | string;
  status: string;
  createdAt: string;
  currency?: string;
  note?: string;
};

export type WalletTransactionPage = {
  items: WalletTransaction[];
};

export type WalletHold = {
  holdId: string;
  auctionId: string;
  amount: number;
  status: string;
  createdAt: string;
};

export type WalletHoldPage = {
  items: WalletHold[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
};

export type DepositRequest = {
  amount: number;
};

export type TopupResponse = {
  transactionId: string;
  paymentUrl: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};

export type TopupStatus = Omit<TopupResponse, "paymentUrl"> & { updatedAt?: string | null; canResume?: boolean; sessionExpiresAt?: string | null };

export type TopupListItem = TopupStatus & { canResume: boolean; sessionExpiresAt?: string | null };
export type TopupPage = { items: TopupListItem[]; pagination: { pageIndex: number; pageSize: number; totalCount: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean } };
export type ResumeTopupResponse = { transactionId: string; paymentUrl: string; sessionExpiresAt: string };

export type WithdrawalRequest = {
  amount: number;
  currency: "VND";
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
};

export type WithdrawalResponse = {
  withdrawalId: string;
  amount: number;
  fee: number;
  status: string;
  requestedAt: string;
};

export type WithdrawalStatusName = "Pending" | "Approved" | "Processing" | "Completed" | "Rejected" | "Failed" | "Cancelled";

export type Pagination = { pageIndex: number; pageSize: number; totalCount: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean };

/** What the seller sees of a request: state, reason, times. Never who decided. */
export type WithdrawalSummary = {
  withdrawalId: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: WithdrawalStatusName | string;
  bankName: string;
  maskedAccountNumber: string;
  accountHolderName: string;
  requestedAt: string;
  processedAt?: string | null;
  completedAt?: string | null;
  statusReason?: string | null;
};
export type WithdrawalPage = { items: WithdrawalSummary[]; pagination: Pagination };

/** What staff need to pay a request, including the full account number. */
export type AdminWithdrawal = {
  withdrawalId: string;
  walletId: string;
  ownerUserId: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: WithdrawalStatusName | string;
  bankName: string;
  bankAccountNumber: string;
  accountHolderName: string;
  requestedAt: string;
  processedAt?: string | null;
  completedAt?: string | null;
  processedBy?: string | null;
  statusReason?: string | null;
  transferReference?: string | null;
};
export type AdminWithdrawalPage = { items: AdminWithdrawal[]; pagination: Pagination };

export type WithdrawalHistoryEntry = {
  action: string;
  fromStatus?: string | null;
  toStatus: string;
  actorId?: string | null;
  occurredAt: string;
  reason?: string | null;
  transferReference?: string | null;
  verificationEvidence?: string | null;
};

export type WithdrawalAction = "Approve" | "Reject" | "StartProcessing" | "Complete" | "Fail" | "ResolveFailed";

export type ProcessWithdrawalInput = {
  action: WithdrawalAction;
  adminNote?: string;
  transferConfirmed?: boolean;
  transferReference?: string;
  bankVerifiedNotTransferred?: boolean;
  verificationEvidence?: string;
};

export type ProcessedWithdrawal = {
  withdrawalId: string;
  status: string;
  processedAt: string;
  transactionId?: string | null;
  transferReference?: string | null;
  statusReason?: string | null;
};
