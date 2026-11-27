"use client";

import { useRef, useState } from "react";
import { ButtonLink, Card } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { walletService } from "@/features/wallet/services/wallet.service";
import type { WalletBalance } from "@/features/wallet/types";
import { describeDepositFailure } from "./auction-outcome";
import { auctionService } from "./services/auction.service";
import type { DepositRequirement, MyAuctionDeposit } from "./types";

type WalletState = {
  data: WalletBalance | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

type Props = {
  auctionId: string;
  userId: string;
  requirement: DepositRequirement | null;
  deposit: MyAuctionDeposit | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
  wallet?: WalletState;
};

const depositState = (status: string) => ({
  AUTHORIZED: "Đã giữ cọc. Bạn có thể đặt giá.",
  PENDING: "Đang xác nhận khoản cọc. Hãy kiểm tra lại trước khi đặt giá.",
  FAILED: "Chưa giữ được cọc. Kiểm tra số dư và thử lại.",
  RELEASED: "Khoản cọc đã được mở khóa.",
  CAPTURED: "Khoản cọc đã được tính vào đơn đấu giá.",
}[status.toUpperCase()] ?? "Chưa đặt cọc cho phiên này.");

export function AuctionDepositPanel({ auctionId, userId, requirement, deposit, loading, error, reload, wallet: sharedWallet }: Props) {
  const localWallet = useApiResource(sharedWallet ? null : `auction-wallet:${userId}`, (signal) => walletService.getBalance(signal));
  const wallet = sharedWallet ?? localWallet;
  const dialog = useRef<HTMLDialogElement>(null);
  const pendingKey = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsTopUp, setNeedsTopUp] = useState(false);
  const amount = requirement?.depositAmount ?? 0;
  const available = wallet.data?.availableBalance;
  const canCreate = Boolean(requirement?.canJoin && amount > 0 && deposit?.canBid !== true && deposit?.status.toUpperCase() !== "PENDING");

  async function createDeposit() {
    if (!requirement || busy) return;
    setBusy(true);
    setActionError("");
    setNotice("");
    setNeedsTopUp(false);
    const key = pendingKey.current ?? crypto.randomUUID();
    pendingKey.current = key;
    try {
      await auctionService.createDeposit(auctionId, requirement.policyVersion, amount, key);
      pendingKey.current = null;
      dialog.current?.close();
      setNotice("Đã gửi yêu cầu giữ cọc. Hệ thống đang cập nhật quyền đặt giá của bạn.");
      reload();
      wallet.reload();
    } catch (cause) {
      // A refused request locked nothing, so the next try starts fresh. An unknown result keeps the key, so a retry cannot lock twice.
      const failure = describeDepositFailure(cause);
      if (!failure.keepKey) pendingKey.current = null;
      setActionError(failure.message);
      setNeedsTopUp(failure.needsTopUp);
      if (failure.reloadTerms) dialog.current?.close();
      reload();
      wallet.reload();
    } finally {
      setBusy(false);
    }
  }

  return <Card className="card-pad auction-deposit-panel" aria-labelledby="auction-deposit-title">
    <div className="auction-deposit-heading"><div><h2 id="auction-deposit-title">Điều kiện tham gia</h2><p>Tiền cọc được giữ trong Ví Nexus khi bạn tham gia phiên.</p></div><strong>{requirement ? formatMoney(amount) : "Đang tải…"}</strong></div>
    {requirement && <div className="auction-deposit-facts"><div><span>Tỷ lệ cọc</span><strong>{requirement.ratePercent}%</strong></div><div><span>Số dư khả dụng</span><strong>{available === undefined ? "Đang tải…" : formatMoney(available)}</strong></div><div><span>Trạng thái cọc</span><strong>{depositState(deposit?.status ?? "")}</strong></div></div>}
    {(error || wallet.error) && <p className="notice" role="alert">Không tải được điều kiện cọc hoặc số dư ví. Hãy kiểm tra lại.</p>}
    {actionError && <p className="notice" role="alert">{actionError}</p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    <div className="action-row">
      {canCreate && <button type="button" className="button button-primary" disabled={busy || loading || available === undefined || available < amount} onClick={() => { setActionError(""); dialog.current?.showModal(); }}>Đặt cọc để tham gia</button>}
      {((available !== undefined && available < amount) || needsTopUp) && <ButtonLink href={ROUTES.buyer.topUp} variant="secondary">Nạp tiền vào ví</ButtonLink>}
      <button type="button" className="button button-secondary" onClick={() => { reload(); wallet.reload(); }} disabled={loading || busy}>Kiểm tra lại</button>
    </div>
    <dialog ref={dialog} className="auction-deposit-dialog" aria-labelledby="auction-deposit-confirm-title">
      <h2 id="auction-deposit-confirm-title">Xác nhận đặt cọc</h2>
      <p>Ví Nexus sẽ giữ {formatMoney(amount)} cho phiên đấu giá này. Số tiền đang giữ không thể dùng để thanh toán hoặc rút.</p>
      <p>Chính sách phiên bản {requirement?.policyVersion}: nếu vi phạm nghĩa vụ thanh toán, cọc có thể được phân bổ {requirement?.forfeiturePolicy.sellerPercent}% cho người bán và {requirement?.forfeiturePolicy.platformPercent}% cho nền tảng.</p>
      {actionError && <p className="notice" role="alert">{actionError}</p>}
      <div className="action-row"><button type="button" className="button button-secondary" disabled={busy} onClick={() => dialog.current?.close()}>Quay lại</button><button type="button" className="button button-primary" disabled={busy} onClick={() => void createDeposit()}>{busy ? "Đang giữ cọc…" : "Xác nhận đặt cọc"}</button></div>
    </dialog>
  </Card>;
}
