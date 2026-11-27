import { api, unwrap, type ApiResponse } from "@/lib/api/client";

/** A saved bank account of the seller (`/api/v1/wallets/bank-accounts`, Wallet). Seller role only. */
export type BankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BankAccountInput = { bankName: string; accountNumber: string; accountHolderName: string; isDefault: boolean };
export type BankAccountErrors = Partial<Record<keyof BankAccountInput, string>>;

/** Limits mirror `CreateBankAccountCommand`: bank 2-150, number 4-100, holder 2-255. */
export function validateBankAccount(input: BankAccountInput): BankAccountErrors {
  const errors: BankAccountErrors = {};
  const bank = input.bankName.trim();
  const number = input.accountNumber.replace(/\s/g, "");
  const holder = input.accountHolderName.trim();
  if (bank.length < 2 || bank.length > 150) errors.bankName = "Tên ngân hàng từ 2 đến 150 ký tự.";
  if (number.length < 4 || number.length > 100) errors.accountNumber = "Số tài khoản từ 4 đến 100 ký tự.";
  else if (!/^[0-9A-Za-z]+$/.test(number)) errors.accountNumber = "Số tài khoản chỉ gồm chữ và số.";
  if (holder.length < 2 || holder.length > 255) errors.accountHolderName = "Tên chủ tài khoản từ 2 đến 255 ký tự.";
  return errors;
}

export function toBankAccountRequest(input: BankAccountInput): BankAccountInput {
  return { bankName: input.bankName.trim(), accountNumber: input.accountNumber.replace(/\s/g, ""), accountHolderName: input.accountHolderName.trim(), isDefault: input.isDefault };
}

/** Default first; the back end does not promise an order. */
export function sortBankAccounts(accounts: readonly BankAccount[]): BankAccount[] {
  return [...accounts].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

/** Shows the last four characters only, so an account on screen is recognisable without being fully displayed. */
export function maskAccountNumber(number: string): string {
  const clean = number.replace(/\s/g, "");
  return clean.length <= 4 ? clean : `${"•".repeat(Math.min(clean.length - 4, 8))}${clean.slice(-4)}`;
}

export const bankAccountService = {
  async list(signal?: AbortSignal): Promise<BankAccount[]> {
    const raw = unwrap(await api.get<ApiResponse<BankAccount[]> | BankAccount[]>("/api/v1/wallets/bank-accounts", { signal }));
    if (!Array.isArray(raw)) throw new Error("Dữ liệu tài khoản ngân hàng không đúng định dạng.");
    return raw;
  },
  async create(input: BankAccountInput): Promise<BankAccount> {
    return unwrap(await api.post<ApiResponse<BankAccount> | BankAccount>("/api/v1/wallets/bank-accounts", toBankAccountRequest(input)));
  },
  async setDefault(id: string): Promise<void> {
    await api.patch(`/api/v1/wallets/bank-accounts/${encodeURIComponent(id)}/default`, {});
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/api/v1/wallets/bank-accounts/${encodeURIComponent(id)}`);
  },
};
