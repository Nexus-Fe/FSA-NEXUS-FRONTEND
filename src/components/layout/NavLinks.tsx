"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { NavigationItem, NavigationSection } from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";
import { Icon } from "@/components/ui/Icon";

function isHrefMatch(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function findBestMatchHref(pathname: string, items: readonly NavigationItem[]): string | null {
  let best: string | null = null;
  for (const item of items) {
    if (isHrefMatch(pathname, item.href)) {
      if (!best || item.href.length > best.length) {
        best = item.href;
      }
    }
  }
  return best;
}

export function NavLinks({
  items = [],
  sections,
  variant = "side",
  ariaLabel = "Điều hướng",
  catalogMenu,
}: {
  items?: NavigationItem[];
  sections?: NavigationSection[];
  variant?: "side" | "top";
  ariaLabel?: string;
  catalogMenu?: ReactNode;
}) {
  const pathname = usePathname();
  const navInstanceId = useId();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [pending, setPending] = useState<{ fromPath: string; href: string } | null>(null);
  const optimisticHref = variant === "top" && pending?.fromPath === pathname ? pending.href : null;
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const initializedRef = useRef(false);

  const flatItems = useMemo(() => {
    if (!sections) return items;
    return sections.flatMap((section) => (section.kind === "item" ? [section.item] : section.group.items));
  }, [items, sections]);

  const bestMatchHref = useMemo(() => findBestMatchHref(pathname, flatItems), [pathname, flatItems]);

  const activeGroupId = useMemo(() => {
    if (!sections || !bestMatchHref) return null;
    for (const section of sections) {
      if (section.kind === "group" && section.group.items.some((item) => item.href === bestMatchHref)) {
        return section.group.id;
      }
    }
    return null;
  }, [sections, bestMatchHref]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

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
    if (!activeLink) {
      if (indicatorRef.current) indicatorRef.current.dataset.visible = "false";
      return;
    }
    moveIndicator(activeLink, initializedRef.current);
    initializedRef.current = true;
  }, [pathname, variant, items, optimisticHref]);

  useEffect(() => {
    if (variant !== "top" || !navRef.current) return;
    const nav = navRef.current;
    const observer = new ResizeObserver(() => {
      const activeLink = nav.querySelector<HTMLElement>(".nav-link.active");
      if (activeLink) {
        moveIndicator(activeLink, false);
      } else if (indicatorRef.current) {
        indicatorRef.current.dataset.visible = "false";
      }
    });
    observer.observe(nav);
    nav.querySelectorAll<HTMLElement>(".nav-link").forEach((link) => observer.observe(link.closest<HTMLElement>(".buyer-nav-catalog") ?? link));
    return () => observer.disconnect();
  }, [items, variant]);

  const renderFlatItem = (item: NavigationItem, extraClassName?: string) => {
    const current = bestMatchHref === item.href;
    const active = optimisticHref ? item.href === optimisticHref : current;
    const className = [active ? "nav-link active" : "nav-link", extraClassName].filter(Boolean).join(" ");
    const link = (
      <Link
        className={className}
        href={item.href}
        aria-current={current ? "page" : undefined}
        onClick={(event) => {
          if (variant !== "top" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
          if (!current) setPending({ fromPath: pathname, href: item.href });
          moveIndicator(event.currentTarget, true);
        }}
      >
        <Icon name={item.icon} size={extraClassName === "side-nav-sublink" || extraClassName === "side-nav-top-item" ? 16 : 18} />
        <span>{item.label}</span>
      </Link>
    );

    if (variant === "top" && catalogMenu && item.href === ROUTES.catalog.index) {
      return (
        <div
          key={item.href}
          className="buyer-nav-catalog"
          onMouseEnter={() => setCatalogOpen(true)}
          onMouseLeave={() => setCatalogOpen(false)}
          onFocusCapture={() => setCatalogOpen(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setCatalogOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setCatalogOpen(false);
          }}
        >
          {link}
          <button
            type="button"
            className="buyer-nav-catalog-toggle"
            aria-label="Mở danh mục sản phẩm"
            aria-expanded={catalogOpen}
            aria-controls="buyer-catalog-menu"
            onClick={() => setCatalogOpen(true)}
          >
            <Icon name="chevronDown" size={14} />
          </button>
          <div
            id="buyer-catalog-menu"
            className="buyer-nav-panel"
            data-open={catalogOpen}
            onClickCapture={(event) => {
              if ((event.target as HTMLElement).closest("a")) setCatalogOpen(false);
            }}
          >
            {catalogMenu}
          </div>
        </div>
      );
    }

    return (
      <span key={item.href} className="buyer-nav-item">
        {link}
      </span>
    );
  };

  if (variant === "side" && sections) {
    return (
      <nav ref={navRef} aria-label={ariaLabel} className="side-nav">
        {sections.map((section) => {
          if (section.kind === "item") {
            return renderFlatItem(section.item, "side-nav-top-item");
          }

          const { group } = section;
          const isOpen = openGroups[group.id] ?? (group.id === activeGroupId);
          const hasActiveChild = group.items.some((item) => item.href === bestMatchHref);
          const toggleClass = [
            "side-nav-group-toggle",
            hasActiveChild ? "has-active" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div
              key={group.id}
              className="side-nav-group"
              data-open={isOpen ? "true" : "false"}
              data-active={hasActiveChild ? "true" : "false"}
            >
              <button
                type="button"
                className={toggleClass}
                aria-expanded={isOpen}
                aria-controls={`${navInstanceId}-group-${group.id}`}
                onClick={() =>
                  setOpenGroups((prev) => ({
                    ...prev,
                    [group.id]: !(prev[group.id] ?? (group.id === activeGroupId)),
                  }))
                }
              >
                <Icon name="chevron" size={14} className="side-nav-group-chevron" />
                <Icon name={group.icon} size={16} />
                <span className="side-nav-group-label">{group.label}</span>
              </button>
              <div
                id={`${navInstanceId}-group-${group.id}`}
                className="side-nav-group-items"
                hidden={!isOpen}
              >
                {group.items.map((item) => renderFlatItem(item, "side-nav-sublink"))}
              </div>
            </div>
          );
        })}
      </nav>
    );
  }

  return (
    <nav ref={navRef} aria-label={ariaLabel} className={variant === "side" ? "side-nav" : "top-nav fluid-nav"}>
      {variant === "top" && <span ref={indicatorRef} className="fluid-nav-indicator" aria-hidden="true" />}
      {items.map((item) => renderFlatItem(item))}
    </nav>
  );
}
