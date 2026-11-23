import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ROUTES } from "@/constants/routes";

async function RedirectToResult({ searchParams }: { searchParams: Promise<{ transactionId?: string }> }) {
  const { transactionId } = await searchParams;
  return redirect(`${ROUTES.buyer.topUpResult}?checkout=return${transactionId ? `&transactionId=${encodeURIComponent(transactionId)}` : ""}`);
}

export default function PaymentSuccessPage({ searchParams }: { searchParams: Promise<{ transactionId?: string }> }) {
  return <Suspense fallback={<p>Đang mở kết quả thanh toán…</p>}><RedirectToResult searchParams={searchParams} /></Suspense>;
}
