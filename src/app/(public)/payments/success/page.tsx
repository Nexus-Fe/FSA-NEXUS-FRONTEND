import { WalletTopUpResult } from "@/features/wallet/WalletTopUpFlow";

export default async function PaymentSuccessPage({ searchParams }: {
  searchParams: Promise<{ transactionId?: string | string[] }>;
}) {
  const { transactionId } = await searchParams;
  return <WalletTopUpResult transactionId={typeof transactionId === "string" ? transactionId : ""} />;
}
