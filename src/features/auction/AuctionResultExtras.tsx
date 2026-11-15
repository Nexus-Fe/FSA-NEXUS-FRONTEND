import { formatMoney } from "@/lib/presentation";
import type { AuctionResult } from "./types";

export function AuctionResultExtras({ result }: { result: AuctionResult }) {
  return <>
    <div className="info-row"><span>Giai đoạn</span><strong>{result.phase}</strong></div>
    {result.myDeposit && <div className="info-row"><span>Cọc của bạn</span><strong>{formatMoney(result.myDeposit.amount)} · {result.myDeposit.status}</strong></div>}
    {result.settlement && <><div className="info-row"><span>Đã đặt cọc</span><strong>{formatMoney(result.settlement.depositAmount)}</strong></div><div className="info-row"><span>Còn cần thanh toán</span><strong>{formatMoney(result.settlement.remainingAmount)}</strong></div><div className="info-row"><span>Trạng thái đơn</span><strong>{result.settlement.settlementStatus}</strong></div></>}
    {result.secondChance && <div className="info-row"><span>Lời mời người về nhì</span><strong>{result.secondChance.status}{result.secondChance.respondBy ? ` · ${new Date(result.secondChance.respondBy).toLocaleString("vi-VN")}` : ""}</strong></div>}
  </>;
}
