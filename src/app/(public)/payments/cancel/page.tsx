import { Suspense } from "react";
import { WalletTopUpResult } from "@/features/wallet/WalletTopUpFlow";

async function PaymentCancelContent({
  searchParams,
}: {
  searchParams: Promise<{ transactionId?: string | string[] }>;
}) {
  const { transactionId } = await searchParams;
  return <WalletTopUpResult transactionId={typeof transactionId === "string" ? transactionId : ""} cancelled />;
}

export default function PaymentCancelPage(props: {
  searchParams: Promise<{ transactionId?: string | string[] }>;
}) {
  return (
    <Suspense fallback={null}>
      <PaymentCancelContent searchParams={props.searchParams} />
    </Suspense>
  );
}
