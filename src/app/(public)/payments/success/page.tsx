import { Suspense } from "react";
import { WalletTopUpResult } from "@/features/wallet/WalletTopUpFlow";

async function PaymentSuccessContent({
  searchParams,
}: {
  searchParams: Promise<{ transactionId?: string | string[] }>;
}) {
  const { transactionId } = await searchParams;
  return <WalletTopUpResult transactionId={typeof transactionId === "string" ? transactionId : ""} />;
}

export default function PaymentSuccessPage(props: {
  searchParams: Promise<{ transactionId?: string | string[] }>;
}) {
  return (
    <Suspense fallback={null}>
      <PaymentSuccessContent searchParams={props.searchParams} />
    </Suspense>
  );
}
