"use client";

import { useState, type FormEvent } from "react";
import { Badge, Card } from "@/components/ui/Primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { DataState, ErrorState } from "@/components/ui/States";
import { useApiResource } from "@/lib/api/use-api-resource";
import { bankAccountService, maskAccountNumber, sortBankAccounts, validateBankAccount, type BankAccount, type BankAccountErrors, type BankAccountInput } from "./bank-accounts";

/** Saved bank accounts. `onPick` fills the withdrawal form from a saved account; the form still lets the seller type one by hand. */
export function BankAccountsPanel({ onPick }: { onPick?: (account: BankAccount) => void }) {
  const accounts = useApiResource("seller-bank-accounts", (signal) => bankAccountService.list(signal));
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<BankAccount | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const list = sortBankAccounts(accounts.data ?? []);

  async function makeDefault(account: BankAccount) {
    setBusyId(account.id);
    setFailure(null);
    try {
      await bankAccountService.setDefault(account.id);
      accounts.reload();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!removing) return;
    setRemoveBusy(true);
    setFailure(null);
    try {
      await bankAccountService.remove(removing.id);
      setRemoving(null);
      accounts.reload();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <Card className="card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Tài khoản ngân hàng đã lưu</h2>
        <button type="button" className="button button-secondary button-small" onClick={() => { setFailure(null); setAdding(true); }}>Thêm tài khoản</button>
      </div>
      {failure != null && !removing && <ErrorState cause={failure} operation="write" />}
      <DataState loading={accounts.loading} error={accounts.error} empty={list.length === 0} emptyTitle="Chưa lưu tài khoản nào" onRetry={accounts.reload}>
        <ul className="plain-list">
          {list.map((account) => (
            <li key={account.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "8px 0" }}>
              <span>
                <strong>{account.bankName}</strong> · {maskAccountNumber(account.accountNumber)}<br />
                <small>{account.accountHolderName}</small> {account.isDefault && <Badge tone="green">Mặc định</Badge>}
              </span>
              <span className="action-row">
                {onPick && <button type="button" className="button button-secondary button-small" onClick={() => onPick(account)}>Dùng để rút</button>}
                {!account.isDefault && <button type="button" className="button button-secondary button-small" disabled={busyId === account.id} onClick={() => void makeDefault(account)}>{busyId === account.id ? "Đang lưu…" : "Đặt mặc định"}</button>}
                <button type="button" className="button button-secondary button-small" onClick={() => { setFailure(null); setRemoving(account); }}>Xóa</button>
              </span>
            </li>
          ))}
        </ul>
      </DataState>
      {adding && <AddDialog onClose={() => setAdding(false)} onSaved={() => { setAdding(false); accounts.reload(); }} />}
      <ConfirmDialog open={removing !== null} title="Xóa tài khoản ngân hàng này?" confirmLabel="Xóa tài khoản" busy={removeBusy} error={removing ? failure : null} onConfirm={() => void remove()} onClose={() => setRemoving(null)}>
        <p>{removing ? `${removing.bankName} · ${maskAccountNumber(removing.accountNumber)} sẽ bị xóa khỏi sổ. Các yêu cầu rút đã gửi không bị ảnh hưởng.` : ""}</p>
      </ConfirmDialog>
    </Card>
  );
}

function AddDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<BankAccountInput>({ bankName: "", accountNumber: "", accountHolderName: "", isDefault: false });
  const [errors, setErrors] = useState<BankAccountErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateBankAccount(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setFailure(null);
    try {
      await bankAccountService.create(form);
      onSaved();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  const text = (key: "bankName" | "accountNumber" | "accountHolderName", label: string) => (
    <label>{label}
      <input className="field" value={form[key]} disabled={busy} aria-invalid={Boolean(errors[key])} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
      {errors[key] && <small className="checkout-field-error" role="alert">{errors[key]}</small>}
    </label>
  );

  return (
    <Modal open title="Thêm tài khoản ngân hàng" busy={busy} onClose={onClose}>
      <form className="voucher-form" onSubmit={(event) => void submit(event)} noValidate>
        {text("bankName", "Ngân hàng")}
        {text("accountNumber", "Số tài khoản")}
        {text("accountHolderName", "Tên chủ tài khoản")}
        <label className="voucher-checkbox"><input type="checkbox" disabled={busy} checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} />Đặt làm tài khoản mặc định</label>
        {failure != null && <ErrorState cause={failure} operation="write" />}
        <div className="voucher-dialog-actions">
          <button type="button" className="button button-secondary" disabled={busy} onClick={onClose}>Đóng</button>
          <button type="submit" className="button button-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu tài khoản"}</button>
        </div>
      </form>
    </Modal>
  );
}
