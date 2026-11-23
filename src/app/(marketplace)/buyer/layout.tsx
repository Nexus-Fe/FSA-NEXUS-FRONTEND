import type { ReactNode } from "react";
import { RoleGate } from "@/components/auth/RoleGate";

export default function BuyerLayout({ children }: { children: ReactNode }) {
  return <RoleGate allowedRoles={["Buyer", "Customer", "Seller"]}>{children}</RoleGate>;
}
