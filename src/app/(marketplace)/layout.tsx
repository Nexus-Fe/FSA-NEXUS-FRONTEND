import type { ReactNode } from "react";
import { BuyerShellClient } from "@/components/client/ClientShells";

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return <BuyerShellClient>{children}</BuyerShellClient>;
}
