"use client";

import type { ReactNode } from "react";
import { adminNavigationSections, sellerNavigation, staffNavigation } from "@/constants/navigation";
import { AuthShell, BuyerShell, PortalShell } from "@/components/layout/Shells";
import { useEnabledNavigation, useEnabledNavigationSections } from "@/lib/features/use-enabled-navigation";

export function AuthShellClient({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}

export function BuyerShellClient({ children }: { children: ReactNode }) {
  return <BuyerShell>{children}</BuyerShell>;
}

export function SellerShellClient({ children }: { children: ReactNode }) {
  const items = useEnabledNavigation(sellerNavigation);
  return <PortalShell role="Người bán" subtitle="Kênh người bán" items={items}>{children}</PortalShell>;
}

export function StaffShellClient({ children }: { children: ReactNode }) {
  const items = useEnabledNavigation(staffNavigation);
  return <PortalShell role="Nhân viên" subtitle="Vận hành sàn" items={items}>{children}</PortalShell>;
}

export function AdminShellClient({ children }: { children: ReactNode }) {
  const sections = useEnabledNavigationSections(adminNavigationSections);
  return <PortalShell role="Quản trị viên" subtitle="Quản trị hệ thống" sections={sections}>{children}</PortalShell>;
}
