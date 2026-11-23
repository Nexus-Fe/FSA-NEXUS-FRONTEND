"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { NavigationItem } from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";
import { Icon } from "@/components/ui/Icon";

export function NavLinks({ items, variant = "side", ariaLabel = "Điều hướng", catalogMenu }: { items: NavigationItem[]; variant?: "side" | "top"; ariaLabel?: string; catalogMenu?: ReactNode }) {
  const pathname = usePathname();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [pending, setPending] = useState<{ fromPath: string; href: string } | null>(null);
  const optimisticHref = variant === "top" && pending?.fromPath === pathname ? pending.href : null;
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setPending(null), pending.fromPath === pathname ? 5000 : 0);
    return () => window.clearTimeout(timer);
  }, [pathname, pending]);

  const moveIndicator = (link: HTMLElement, animate: boolean) => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;
    const target = link.closest<HTMLElement>(".buyer-nav-catalog") ?? link;
    const navBounds = nav.getBoundingClientRect();
    const bounds = target.getBoundingClientRect();
    indicator.style.transitionDuration = animate ? "" : "0ms";
    indicator.style.left = `${bounds.left - navBounds.left + nav.scrollLeft}px`;
    indicator.style.top = `${bounds.top - navBounds.top}px`;
    indicator.style.width = `${bounds.width}px`;
    indicator.style.height = `${bounds.height}px`;
    indicator.dataset.visible = "true";
  };

  useLayoutEffect(() => {
    if (variant !== "top") return;
    const activeLink = navRef.current?.querySelector<HTMLElement>(".nav-link.active");
    if (!activeLink) return;
    moveIndicator(activeLink, initializedRef.current);
    initializedRef.current = true;
  }, [pathname, variant, items, optimisticHref]);

  useEffect(() => {
    if (variant !== "top" || !navRef.current) return;
    const nav = navRef.current;
    const observer = new ResizeObserver(() => {
      const activeLink = nav.querySelector<HTMLElement>(".nav-link.active");
      if (activeLink) moveIndicator(activeLink, false);
    });
    observer.observe(nav);
    nav.querySelectorAll<HTMLElement>(".nav-link").forEach((link) => observer.observe(link.closest<HTMLElement>(".buyer-nav-catalog") ?? link));
    return () => observer.disconnect();
  }, [items, variant]);

  return <nav ref={navRef} aria-label={ariaLabel} className={variant === "side" ? "side-nav" : "top-nav fluid-nav"}>
    {variant === "top" && <span ref={indicatorRef} className="fluid-nav-indicator" aria-hidden="true" />}
    {items.map((item) => {
    const current = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
    const active = optimisticHref ? item.href === optimisticHref : current;
    const link = <Link className={active ? "nav-link active" : "nav-link"} href={item.href} aria-current={current ? "page" : undefined} onClick={(event) => {
      if (variant !== "top" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
      if (!current) setPending({ fromPath: pathname, href: item.href });
      moveIndicator(event.currentTarget, true);
    }}><Icon name={item.icon} size={18} /><span>{item.label}</span></Link>;
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
