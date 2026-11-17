import { WalletTopUpResult } from "@/features/wallet/WalletTopUpFlow";

export default async function PaymentCancelPage({ searchParams }: {
  searchParams: Promise<{ transactionId?: string | string[] }>;
}) {
  const { transactionId } = await searchParams;
  return <WalletTopUpResult transactionId={typeof transactionId === "string" ? transactionId : ""} cancelled />;
}
