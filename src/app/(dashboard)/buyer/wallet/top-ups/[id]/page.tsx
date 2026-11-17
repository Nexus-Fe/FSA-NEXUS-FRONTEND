"use client";

import { useParams } from "next/navigation";
import { WalletTopUpResult } from "@/features/wallet/WalletTopUpFlow";

export default function TopUpDetailPage() {
  const params = useParams<{ id: string }>();
  return <WalletTopUpResult transactionId={params.id} />;
}
