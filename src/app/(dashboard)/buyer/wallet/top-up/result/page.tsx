import { Suspense } from "react";
import { WalletTopUpResult } from "@/features/wallet/WalletTopUpFlow";

async function TopUpResultContent({
  searchParams,
}: {
  searchParams: Promise<{ transactionId?: string | string[] }>;
}) {
  const { transactionId } = await searchParams;
  return <WalletTopUpResult transactionId={typeof transactionId === "string" ? transactionId : ""} />;
}

export default function TopUpResultPage(props: {
  searchParams: Promise<{ transactionId?: string | string[] }>;
}) {
  return (
    <Suspense fallback={null}>
      <TopUpResultContent searchParams={props.searchParams} />
    </Suspense>
  );
}
