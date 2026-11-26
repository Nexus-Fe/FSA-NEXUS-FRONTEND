"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink, Card } from "@/components/ui/Primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ROUTES } from "@/constants/routes";
import { ApiError } from "@/lib/api/client";
import { createIntentKeyStore, createKeyGenerator, isDefiniteOutcome } from "@/lib/idempotency/intent-key";
import { formatMoney } from "@/lib/presentation";
import { buyNowConfirmText, buyNowSuccessText, describeBuyNowFailure } from "./buy-now-outcome";
import { auctionService } from "./services/auction.service";

/**
 * "Mua ngay". The route requires an Idempotency-Key and reads the auction's row version from If-Match. The key is kept while the result
 * is unknown, so pressing again cannot lock the money twice; it is released once the server has answered definitely.
 */
export function AuctionBuyNowPanel({ auctionId, price, version, reload, availableBalance, authorizedDepositAmount = 0 }: { auctionId: string; price: number; version?: string; reload: () => void; availableBalance?: number; authorizedDepositAmount?: number }) {
  const router = useRouter();
  const intent = useRef(createIntentKeyStore(createKeyGenerator("buynow")));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsTopUp, setNeedsTopUp] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [done, setDone] = useState(false);
  const depositCredit = Math.max(0, authorizedDepositAmount);
  const requiredAvailable = Math.max(0, price - depositCredit);
  const insufficientAvailable = availableBalance !== undefined && availableBalance < requiredAvailable;

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNeedsTopUp(false);
    try {
      await auctionService.buyNow(auctionId, intent.current.keyFor(`${auctionId}:${price}`), version);
      intent.current.settle();
      setDone(true);
      setUnknown(false);
      setOpen(false);
      router.push(ROUTES.buyer.auctionPayment(auctionId));
    } catch (cause) {
      const failure = describeBuyNowFailure(cause);
      const status = cause instanceof ApiError ? cause.status : undefined;
      if (!failure.unknownOutcome || isDefiniteOutcome(status)) intent.current.settle();
      setUnknown(failure.unknownOutcome);
      setNeedsTopUp(failure.needsTopUp);
      setError(failure.message);
      if (failure.reload) {
        setOpen(false);
        reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="card-pad auction-buy-now">
      <h2>Mua ngay</h2>
      <p>Giá mua ngay: <strong>{formatMoney(price)}</strong></p>
      {depositCredit > 0 && (
        <p className="status-note">Đã giữ cọc: <strong>{formatMoney(depositCredit)}</strong> · Cần khóa thêm: <strong>{formatMoney(requiredAvailable)}</strong></p>
      )}
      {availableBalance !== undefined && (
        <p className="status-note">
          Số dư khả dụng: <strong>{formatMoney(availableBalance)}</strong>
          {insufficientAvailable ? ` · Cần thêm ${formatMoney(requiredAvailable - availableBalance)} để Mua ngay.` : ""}
        </p>
      )}
      {error && !open && <p className="notice" role="alert">{error}</p>}
      {done && <p className="form-success" role="status">{buyNowSuccessText()}</p>}
      <div className="action-row">
        <button type="button" className="button button-primary" disabled={busy || done || insufficientAvailable} onClick={() => { setError(""); setOpen(true); }}>Mua ngay</button>
        {(needsTopUp || insufficientAvailable) && <ButtonLink href={ROUTES.buyer.topUp} variant="secondary">Nạp tiền vào ví</ButtonLink>}
        {unknown && <button type="button" className="button button-secondary" disabled={busy} onClick={() => router.push(ROUTES.buyer.auctionPayment(auctionId))}>Kiểm tra lại</button>}
      </div>
      <ConfirmDialog open={open} title="Xác nhận mua ngay" confirmLabel="Khóa tiền và mua ngay" cancelLabel="Quay lại" busy={busy} onConfirm={() => void confirm()} onClose={() => setOpen(false)}>
        <p>{buyNowConfirmText(formatMoney(price))}</p>
        {availableBalance !== undefined && <p className="status-note">Số dư khả dụng hiện có: <strong>{formatMoney(availableBalance)}</strong></p>}
        {error && <p className="notice" role="alert">{error}</p>}
      </ConfirmDialog>
    </Card>
  );
}
