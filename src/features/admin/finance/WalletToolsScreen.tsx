"use client";

import { useState } from "react";
import { AdminPagination, Badge, Card, PageHeading } from "@/components/ui/Primitives";
import { FluidChoiceBar } from "@/components/ui/FluidChoiceBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataState, ErrorState } from "@/components/ui/States";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { transactionDate } from "@/features/wallet/WalletScreen";
import { validateResolveReason, walletToolsService, type StripeAttempt } from "./wallet-tools.service";

type Tab = "wallets" | "holds" | "stripe";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "wallets", label: "Ví" },
  { key: "holds", label: "Khoản giữ đấu giá" },
  { key: "stripe", label: "Đối soát Stripe" },
];

/** Wallet support tools for admin: wallets, auction deposit holds and Stripe payments waiting for a manual decision. */
export function WalletToolsScreen() {
  const [tab, setTab] = useState<Tab>("wallets");
  return (
    <>
      <PageHeading title="Công cụ ví" description="Tra cứu ví, khoản giữ cọc đấu giá và thanh toán Stripe cần đối soát." />
      <FluidChoiceBar compact ariaLabel="Công cụ ví" options={TABS.map((item) => ({ value: item.key, label: item.label }))} value={tab} onChange={setTab} />
      {tab === "wallets" && <WalletsTab />}
      {tab === "holds" && <HoldsTab />}
      {tab === "stripe" && <StripeTab />}
    </>
  );
}

function WalletsTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const wallets = useApiResource(`admin-wallets:${page}:${search}:${status}`, (signal) => walletToolsService.wallets({ page, search, status }, signal));
  return (
    <Card className="card-pad">
      <div className="voucher-filters">
        <label>Tìm theo mã người dùng<input className="field" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        <label>Trạng thái<select className="select-field" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả</option><option value="Active">Hoạt động</option><option value="Frozen">Đã đóng băng</option></select></label>
      </div>
      <DataState loading={wallets.loading} error={wallets.error} empty={!wallets.data?.items.length} emptyTitle="Không có ví phù hợp" onRetry={wallets.reload}>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Người dùng</th><th>Số dư</th><th>Khả dụng</th><th>Đang khóa</th><th>Trạng thái</th><th>Cập nhật</th></tr></thead>
            <tbody>
              {wallets.data?.items.map((wallet) => (
                <tr key={wallet.walletId}>
                  <td className="mono">{wallet.userId}</td>
                  <td className="tabular-nums">{formatMoney(wallet.balance)}</td>
                  <td className="tabular-nums">{formatMoney(wallet.availableBalance)}</td>
                  <td className="tabular-nums">{formatMoney(wallet.lockedBalance)}</td>
                  <td><Badge tone={wallet.status.toUpperCase() === "ACTIVE" ? "green" : "amber"}>{wallet.status.toUpperCase() === "ACTIVE" ? "Hoạt động" : wallet.status}</Badge></td>
                  <td>{transactionDate(wallet.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
      {wallets.data && wallets.data.pagination.totalPages > 1 && <AdminPagination page={page} pageSize={wallets.data.pagination.pageSize} totalItems={wallets.data.pagination.totalCount} totalPages={wallets.data.pagination.totalPages} onPageChange={setPage} itemLabel="ví" />}
    </Card>
  );
}

function HoldsTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState("");
  const holds = useApiResource(`admin-holds:${page}:${status}:${userId}`, (signal) => walletToolsService.holds({ page, status, userId: userId.trim() || undefined }, signal));
  return (
    <Card className="card-pad">
      <div className="voucher-filters">
        <label>Mã người dùng<input className="field" value={userId} onChange={(event) => { setUserId(event.target.value); setPage(1); }} placeholder="UUID" /></label>
        <label>Trạng thái khoản giữ<input className="field" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} placeholder="Ví dụ: Authorized" /></label>
      </div>
      <DataState loading={holds.loading} error={holds.error} empty={!holds.data?.items.length} emptyTitle="Không có khoản giữ phù hợp" onRetry={holds.reload}>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Chủ ví</th><th>Tham chiếu</th><th>Số tiền</th><th>Trạng thái</th><th>Tạo lúc</th><th>Giải quyết</th></tr></thead>
            <tbody>
              {holds.data?.items.map((hold) => (
                <tr key={hold.holdId}>
                  <td className="mono">{hold.ownerUserId}</td>
                  <td>{hold.referenceType}<br /><small className="mono">{hold.auctionId ?? hold.referenceId}</small></td>
                  <td className="tabular-nums">{formatMoney(hold.amount)}</td>
                  <td><Badge tone="slate">{({ HELD: "Đang giữ", RELEASED: "Đã giải tỏa", CAPTURED: "Đã thu", EXPIRED: "Hết hạn", CANCELLED: "Đã hủy" } as Record<string, string>)[hold.status.toUpperCase()] ?? hold.status}</Badge></td>
                  <td>{transactionDate(hold.createdAt)}</td>
                  <td>{hold.resolvedAt ? transactionDate(hold.resolvedAt) : "Chưa"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
      {holds.data && holds.data.pagination.totalPages > 1 && <AdminPagination page={page} pageSize={holds.data.pagination.pageSize} totalItems={holds.data.pagination.totalCount} totalPages={holds.data.pagination.totalPages} onPageChange={setPage} itemLabel="khoản giữ" />}
    </Card>
  );
}

function StripeTab() {
  const [page, setPage] = useState(1);
  const attempts = useApiResource(`admin-stripe-attempts:${page}`, (signal) => walletToolsService.stripeAttempts(page, signal));
  const [target, setTarget] = useState<{ attempt: StripeAttempt; resolution: "Failed" | "Expired" } | null>(null);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanFailure, setScanFailure] = useState<unknown>(null);

  async function resolve() {
    if (!target) return;
    const issue = validateResolveReason(reason);
    if (issue) { setProblem(issue); return; }
    setProblem("");
    setBusy(true);
    setFailure(null);
    try {
      await walletToolsService.resolveAttempt(target.attempt.attemptId, target.resolution, reason.trim());
      setNotice(`Đã xử lý lần thanh toán ${target.attempt.attemptId.slice(0, 8)} là "${target.resolution === "Failed" ? "thất bại" : "hết hạn"}".`);
      setTarget(null);
      setReason("");
      attempts.reload();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  async function scan() {
    setScanning(true);
    setScanFailure(null);
    setNotice("");
    try {
      const count = await walletToolsService.reconcilePending();
      setNotice(`Đã chạy đối soát các lượt nạp và thanh toán Stripe đang chờ: ${count} lượt được xử lý.`);
      attempts.reload();
    } catch (cause) {
      setScanFailure(cause);
    } finally {
      setScanning(false);
    }
  }

  return (
    <Card className="card-pad">
      <div className="action-row">
        <button type="button" className="button button-secondary" disabled={scanning} onClick={() => void scan()}>{scanning ? "Đang chạy…" : "Chạy đối soát lượt đang chờ"}</button>
      </div>
      {notice && <p className="form-success" role="status">{notice}</p>}
      {scanFailure != null && <ErrorState cause={scanFailure} operation="write" />}
      <DataState loading={attempts.loading} error={attempts.error} empty={!attempts.data?.items.length} emptyTitle="Không có thanh toán nào cần đối soát" onRetry={attempts.reload}>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Mục đích</th><th>Chủ</th><th>Số tiền</th><th>Mã Stripe</th><th>Chặn thay thế</th><th>Cập nhật</th><th>Thao tác</th></tr></thead>
            <tbody>
              {attempts.data?.items.map((attempt) => (
                <tr key={attempt.attemptId}>
                  <td>{attempt.purpose}</td>
                  <td className="mono">{attempt.ownerId}</td>
                  <td className="tabular-nums">{formatMoney(attempt.amount)}</td>
                  <td><small className="mono">{attempt.paymentIntentId ?? attempt.checkoutSessionId ?? "—"}</small></td>
                  <td>{attempt.blocksReplacement ? <Badge tone="amber">Có</Badge> : "Không"}</td>
                  <td>{transactionDate(attempt.updatedAt)}</td>
                  <td>
                    <div className="voucher-row-actions">
                      <button type="button" className="button button-secondary button-small" onClick={() => { setFailure(null); setProblem(""); setReason(""); setTarget({ attempt, resolution: "Failed" }); }}>Đánh dấu thất bại</button>
                      <button type="button" className="button button-secondary button-small" onClick={() => { setFailure(null); setProblem(""); setReason(""); setTarget({ attempt, resolution: "Expired" }); }}>Đánh dấu hết hạn</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
      {attempts.data && attempts.data.pagination.totalPages > 1 && <AdminPagination page={page} pageSize={attempts.data.pagination.pageSize} totalItems={attempts.data.pagination.totalCount} totalPages={attempts.data.pagination.totalPages} onPageChange={setPage} itemLabel="lượt" />}
      <ConfirmDialog
        open={target !== null}
        title={target?.resolution === "Failed" ? "Đánh dấu lượt thanh toán thất bại?" : "Đánh dấu lượt thanh toán hết hạn?"}
        confirmLabel="Xác nhận xử lý"
        busy={busy}
        error={failure}
        onConfirm={() => void resolve()}
        onClose={() => setTarget(null)}
      >
        <p>Lượt thanh toán {target?.attempt.attemptId.slice(0, 8)} ({target ? formatMoney(target.attempt.amount) : ""}) sẽ không được cộng vào ví. Chỉ làm khi đã kiểm tra trên Stripe rằng tiền không được thu.</p>
        <label>Lý do (bắt buộc)<textarea className="field" rows={3} value={reason} disabled={busy} aria-invalid={Boolean(problem)} onChange={(event) => setReason(event.target.value)} /></label>
        {problem && <p className="form-error" role="alert">{problem}</p>}
      </ConfirmDialog>
    </Card>
  );
}
