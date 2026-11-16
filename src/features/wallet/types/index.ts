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
