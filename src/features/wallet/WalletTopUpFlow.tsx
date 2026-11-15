"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { Badge, Card, PageHeading } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { ApiError } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { walletService } from "./services/wallet.service";
import { clearTopupDraft, getTopupIdempotencyKey, readStripePaymentContext, saveStripePaymentContext } from "./stripe-payment-context";

const subscribeToStorage = () => () => {};
const getStoredTopupId = () => readStripePaymentContext()?.transactionId ?? "";
const getServerTopupId = () => "";

export function WalletTopUpForm() {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryConflict, setRetryConflict] = useState(false);
  const [confirm, setConfirm] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value < 10000 || value > 99999999) {
      setError("Nhập số tiền nguyên từ 10.000 đến 99.999.999 ₫.");
      return;
    }
    setError("");
    setConfirm(true);
  }

  async function create() {
    if (busy) return;
    const value = Number(amount);
    setBusy(true);
    setError("");
    setRetryConflict(false);
    try {
      const topup = await walletService.deposit({ amount: value }, getTopupIdempotencyKey(value));
      if (!topup.transactionId || !topup.paymentUrl || new URL(topup.paymentUrl).protocol !== "https:") {
        throw new Error("Cổng thanh toán chưa trả đường dẫn hợp lệ.");
      }
      saveStripePaymentContext({ kind: "topup", transactionId: topup.transactionId });
      clearTopupDraft();
      window.location.assign(topup.paymentUrl);
    } catch (cause) {
      setRetryConflict(cause instanceof ApiError && cause.status === 409);
      setError(cause instanceof ApiError && cause.status === 409
        ? "Yêu cầu đang được đối soát. Hãy kiểm tra lịch sử trước khi thử lại."
        : cause instanceof Error ? cause.message : "Không thể tạo yêu cầu. Hãy kiểm tra lịch sử trước khi thử lại.");
      setBusy(false);
      setConfirm(false);
    }
  }

  return <>
    <PageHeading title="Nạp tiền vào ví" description="Thanh toán qua Stripe. Số dư chỉ cập nhật sau khi ví xác nhận giao dịch." />
    <div className="split">
      <Card className="card-pad"><h2>Thông tin nạp tiền</h2>
        <form className="auth-fields" onSubmit={submit}>
          <label className="field-wrap">Số tiền (₫)<input className="field seller-money-input" type="number" min="10000" max="99999999" step="1" required inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <button className="button button-primary" type="submit" disabled={busy}>Tiếp tục với Stripe</button>
          {error && <p className="notice" role="alert">{error} <Link href={ROUTES.buyer.topUps}>Lịch sử nạp</Link>{retryConflict && <> · <button className="button button-secondary" type="button" onClick={() => { clearTopupDraft(); setRetryConflict(false); setError(""); }}>Bắt đầu lượt nạp mới</button></>}</p>}
        </form>
      </Card>
      <Card className="card-pad"><h2>Theo dõi lượt nạp</h2><p>Bạn có thể mở nhiều lượt nạp. Rời Stripe hoặc đóng tab không tự hủy giao dịch.</p><Link href={ROUTES.buyer.topUps} className="button button-secondary">Lịch sử nạp tiền</Link></Card>
    </div>
    {confirm && <div className="wallet-dialog-backdrop" role="presentation"><div className="card card-pad wallet-dialog" role="dialog" aria-modal="true" aria-labelledby="topup-confirm-title" onKeyDown={(event) => dialogKeys(event, () => { if (!busy) setConfirm(false); })}><h2 id="topup-confirm-title">Xác nhận nạp tiền</h2><p>Thanh toán <strong className="seller-money-amount">{formatMoney(Number(amount))}</strong> qua Stripe.</p><div className="action-row"><button type="button" className="button button-secondary" autoFocus disabled={busy} onClick={() => setConfirm(false)}>Quay lại</button><button type="button" className="button button-primary" disabled={busy} onClick={() => void create()}>{busy ? "Đang tạo phiên…" : "Xác nhận và sang Stripe"}</button></div></div></div>}
  </>;
}

export function TopupBadge({ status }: { status: string }) {
  const value = status.toUpperCase();
  return <Badge tone={value === "SUCCESS" ? "green" : value === "PENDING" ? "amber" : "red"}>{value === "SUCCESS" ? "Thành công" : value === "PENDING" ? "Đang xác nhận" : value === "EXPIRED" ? "Hết hạn" : value === "FAILED" ? "Thất bại" : status}</Badge>;
}

function validPaymentUrl(url: string): boolean {
  try { return new URL(url).protocol === "https:"; } catch { return false; }
}

function dialogKeys(event: React.KeyboardEvent<HTMLDivElement>, close: () => void) {
  if (event.key === "Escape") { event.preventDefault(); close(); return; }
  if (event.key !== "Tab") return;
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled),a[href]")];
  if (!controls.length) return;
  if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
  else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
}

export function WalletTopUpResult({ transactionId, checkout }: { transactionId?: string; checkout?: string }) {
  const legacyId = useSyncExternalStore(subscribeToStorage, getStoredTopupId, getServerTopupId);
  const id = transactionId || legacyId;
  const topup = useApiResource(id ? `stripe-topup:${id}` : null, (signal) => walletService.topupStatus(id, signal));
  const status = topup.data?.status.toUpperCase();
  const success = status === "SUCCESS";
  const failed = status === "FAILED" || status === "EXPIRED";
  const [checks, setChecks] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const balance = useApiResource(success ? `topup-confirmed-balance:${id}` : null, (signal) => walletService.getBalance(signal));
  const { loading, error: loadError, reload } = topup;
  useEffect(() => {
    if (status !== "PENDING" || loading || loadError || checks >= 8) return;
    const timer = window.setTimeout(() => { setChecks((value) => value + 1); reload(); }, 3000);
    return () => window.clearTimeout(timer);
  }, [status, loading, loadError, reload, checks]);
  async function resume() {
    if (resuming || !id) return;
    setResuming(true); setResumeError("");
    try {
      const session = await walletService.resumeTopup(id);
      if (!validPaymentUrl(session.paymentUrl)) throw new Error("Đường dẫn Stripe không hợp lệ.");
      window.location.assign(session.paymentUrl);
    } catch (cause) {
      setResumeError(cause instanceof Error ? cause.message : "Không tiếp tục được phiên thanh toán.");
      setResuming(false); topup.reload();
    }
  }
  return <>
    <PageHeading title="Trạng thái nạp tiền" description="Trạng thái được lấy trực tiếp từ ví Nexus." action={<Link className="button button-secondary" href={ROUTES.buyer.topUps}>Lịch sử nạp</Link>} />
    <div className="split wallet-topup-layout"><Card className="card-pad">
      {!id ? <><p role="status">Chưa xác định được giao dịch. Hãy tìm trong lịch sử nạp.</p><Link className="button button-secondary" href={ROUTES.buyer.topUps}>Xem lịch sử nạp</Link></>
        : <><h2>{topup.loading && !topup.data ? "Đang kiểm tra…" : topup.error ? "Chưa kiểm tra được giao dịch" : success ? "Nạp tiền thành công" : failed ? "Giao dịch không thành công" : "Đang chờ xác nhận"}</h2>
          {checkout === "cancel" && <p className="notice">Bạn đã rời Stripe. Giao dịch có thể vẫn đang chờ xử lý.</p>}
          {topup.data && <><p>Mã giao dịch: <strong>{topup.data.transactionId}</strong></p><p>Số tiền: <strong className="seller-money-amount">{formatMoney(topup.data.amount)}</strong></p><p>Trạng thái: <TopupBadge status={topup.data.status} /></p></>}
          {topup.error && <p className="notice" role="alert">{topup.error.message}{topup.error instanceof ApiError && topup.error.status === 401 && <> · <Link href={`${ROUTES.auth.login}?returnTo=${encodeURIComponent(ROUTES.buyer.topUpDetail(id))}`}>Đăng nhập lại</Link></>}</p>}
          {resumeError && <p className="notice" role="alert">{resumeError}</p>}
          {status === "PENDING" && checks >= 8 && <p role="status">Giao dịch vẫn đang được xử lý. Bạn có thể kiểm tra lại sau.</p>}
          <div className="action-row"><button className="button button-secondary" type="button" disabled={topup.loading} onClick={() => { setChecks(0); topup.reload(); }}>Kiểm tra lại</button>{status === "PENDING" && topup.data?.canResume && <button className="button button-primary" type="button" disabled={resuming} onClick={() => void resume()}>{resuming ? "Đang kiểm tra phiên…" : "Tiếp tục thanh toán"}</button>}<button className="button button-secondary" type="button" onClick={() => setLeaving(true)}>Rời trang thanh toán</button></div>
        </>}
    </Card><Card className="card-pad"><h2>Số dư đã xác nhận</h2>{success ? balance.data ? <strong className="seller-money-amount">{formatMoney(balance.data.balance)}</strong> : <p>{balance.error ? "Chưa tải được số dư. Hãy kiểm tra lại trong Ví." : "Đang tải số dư…"}</p> : <p>Chỉ giao dịch được xác nhận thành công mới cộng vào số dư.</p>}<Link href={ROUTES.buyer.wallet}>Xem ví của tôi</Link></Card></div>
    {leaving && <div className="wallet-dialog-backdrop" role="presentation"><div className="card card-pad wallet-dialog" role="dialog" aria-modal="true" aria-labelledby="topup-leave-title" onKeyDown={(event) => dialogKeys(event, () => setLeaving(false))}><h2 id="topup-leave-title">Rời trang theo dõi?</h2><p>Rời trang không hủy phiên Stripe. Bạn có thể tìm lại giao dịch trong lịch sử nạp.</p><div className="action-row"><button type="button" className="button button-secondary" autoFocus onClick={() => setLeaving(false)}>Ở lại</button><Link className="button button-primary" href={ROUTES.buyer.topUps}>Rời trang</Link></div></div></div>}
  </>;
}

export function WalletTopUpReturn() {
  const params = useSearchParams();
  return <WalletTopUpResult transactionId={params.get("transactionId") ?? undefined} checkout={params.get("checkout") ?? undefined} />;
}
