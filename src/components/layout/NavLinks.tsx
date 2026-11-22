"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { NavigationItem } from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";
import { Icon } from "@/components/ui/Icon";

export function NavLinks({ items, variant = "side", ariaLabel = "Điều hướng", catalogMenu }: { items: NavigationItem[]; variant?: "side" | "top"; ariaLabel?: string; catalogMenu?: ReactNode }) {
  const pathname = usePathname();
  const [catalogOpen, setCatalogOpen] = useState(false);
  return <nav aria-label={ariaLabel} className={variant === "side" ? "side-nav" : "top-nav"}>{items.map((item) => {
    const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
    const link = <Link className={active ? "nav-link active" : "nav-link"} href={item.href} aria-current={active ? "page" : undefined}><Icon name={item.icon} size={18} /><span>{item.label}</span></Link>;
    if (variant === "top" && catalogMenu && item.href === ROUTES.catalog.index) {
      return <div key={item.href} className="buyer-nav-catalog" onMouseEnter={() => setCatalogOpen(true)} onMouseLeave={() => setCatalogOpen(false)} onFocusCapture={() => setCatalogOpen(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setCatalogOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setCatalogOpen(false); }}>
        {link}
        <button type="button" className="buyer-nav-catalog-toggle" aria-label="Mở danh mục sản phẩm" aria-expanded={catalogOpen} aria-controls="buyer-catalog-menu" onClick={() => setCatalogOpen(true)}><Icon name="chevronDown" size={14} /></button>
        <div id="buyer-catalog-menu" className="buyer-nav-panel" data-open={catalogOpen} onClickCapture={(event) => { if ((event.target as HTMLElement).closest("a")) setCatalogOpen(false); }}>
          {catalogMenu}
        </div>
      </div>;
    }
    return <span key={item.href} className="buyer-nav-item">{link}</span>;
  })}</nav>;
}
