import { Suspense } from "react";
import { WalletTopUpReturn } from "@/features/wallet/WalletTopUpFlow";

export default function TopUpResultPage() {
  return <Suspense fallback={<p>Đang kiểm tra giao dịch…</p>}><WalletTopUpReturn /></Suspense>;
}
