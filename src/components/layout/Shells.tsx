"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { memo, Suspense, useEffect, useState, type ReactNode } from "react";
import { AccountMenu, type AccountMenuItem } from "./AccountMenu";
import type { NavigationItem } from "@/constants/navigation";
import { buyerNavigation } from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";
import { Icon } from "@/components/ui/Icon";
import { BackToTop } from "@/components/ui/BackToTop";
import { useSession } from "@/components/auth/SessionProvider";
import { useResolvedAvatar } from "@/lib/auth/avatar-storage";
import { authService } from "@/features/auth";
import { NotificationBell } from "@/features/notification";
import { notificationService, notificationsChangedEvent } from "@/features/notification/services/notification.service";
import { NexusBrandHeader } from "@/components/ui/NexusLogo";
import { useEnabledNavigation } from "@/lib/features/use-enabled-navigation";
import { NavLinks } from "./NavLinks";
import { Breadcrumbs } from "./Breadcrumbs";
import { useApiResource } from "@/lib/api/use-api-resource";
import { categoryGroups, loadCategories } from "@/features/catalog/categories";

const roleDashboardLinks = [
  { role: "admin", label: "Quản trị hệ thống", href: ROUTES.admin.overview, icon: "shield" },
  { role: "staff", label: "Vận hành sàn", href: ROUTES.staff.auctions, icon: "gavel" },
  { role: "seller", label: "Kênh người bán", href: ROUTES.seller.products, icon: "grid" },
] as const;

export type ActiveRoleInfo = {
  key: "admin" | "staff" | "seller" | "buyer";
  label: string;
  tone: "indigo" | "sky" | "amber" | "slate";
};

export function getNormalizedRoles(
  user: { roles?: string[]; role?: string | null } | null | undefined,
): string[] {
  const rawRoles = user?.roles?.length
    ? user.roles
    : user?.role
      ? [user.role]
      : [];

  return rawRoles.map((r) =>
    r.toLocaleLowerCase("en-US").replace(/^role_/, "").replace(/[\s_-]+/g, "")
  );
}

export function resolveUserRole(
  user: { roles?: string[]; role?: string | null } | null | undefined,
  contextualRole?: string,
): ActiveRoleInfo | null {
  if (!user && !contextualRole) return null;

  const normalized = getNormalizedRoles(user);

  // If in a portal and the user possesses that portal's role, favor that context:
  if (contextualRole) {
    const ctx = contextualRole.toLocaleLowerCase("en-US");
    if ((ctx.includes("bán") || ctx.includes("seller")) && normalized.includes("seller")) {
      return { key: "seller", label: "Người bán", tone: "amber" };
    }
    if ((ctx.includes("nhân viên") || ctx.includes("staff")) && (normalized.includes("staff") || normalized.includes("supportstaff"))) {
      return { key: "staff", label: "Nhân viên", tone: "sky" };
    }
    if ((ctx.includes("quản trị") || ctx.includes("admin")) && (normalized.includes("admin") || normalized.includes("administrator"))) {
      return { key: "admin", label: "Quản trị viên", tone: "indigo" };
    }
  }

  // System role precedence: Admin > Staff > Seller > Buyer
  if (normalized.includes("admin") || normalized.includes("administrator")) {
    return { key: "admin", label: "Quản trị viên", tone: "indigo" };
  }
  if (normalized.includes("staff") || normalized.includes("supportstaff")) {
    return { key: "staff", label: "Nhân viên", tone: "sky" };
  }
  if (normalized.includes("seller")) {
    return { key: "seller", label: "Người bán", tone: "amber" };
  }
  if (normalized.includes("buyer") || normalized.includes("customer")) {
    return { key: "buyer", label: "Người mua", tone: "slate" };
  }

  // If user object exists but no matching role string, default to Buyer for authenticated user
  if (user) {
    return { key: "buyer", label: "Người mua", tone: "slate" };
  }

  // Fallback to contextual role string if user session is not yet loaded:
  if (contextualRole) {
    const ctx = contextualRole.toLocaleLowerCase("en-US");
    if (ctx.includes("quản trị") || ctx.includes("admin")) return { key: "admin", label: contextualRole, tone: "indigo" };
    if (ctx.includes("nhân viên") || ctx.includes("staff")) return { key: "staff", label: contextualRole, tone: "sky" };
    if (ctx.includes("bán") || ctx.includes("seller")) return { key: "seller", label: contextualRole, tone: "amber" };
    return { key: "buyer", label: contextualRole, tone: "slate" };
  }

  return null;
}

export function getRoleHomeRoute(
  user: { roles?: string[]; role?: string | null } | null | undefined,
  contextualRole?: string,
): string {
  const normalized = getNormalizedRoles(user);

  if (contextualRole) {
    const ctx = contextualRole.toLocaleLowerCase("en-US");
    if (ctx.includes("quản trị") || ctx.includes("admin")) return ROUTES.admin.overview;
    if (ctx.includes("nhân viên") || ctx.includes("staff")) return ROUTES.staff.auctions;
    if (ctx.includes("bán") || ctx.includes("seller")) return ROUTES.seller.products;
  }

  if (normalized.includes("admin") || normalized.includes("administrator")) {
    return ROUTES.admin.overview;
  }
  if (normalized.includes("staff") || normalized.includes("supportstaff")) {
    return ROUTES.staff.auctions;
  }
  if (normalized.includes("seller") && contextualRole) {
    return ROUTES.seller.products;
  }
  return ROUTES.home;
}

export function getRoleHomeLabel(
  user: { roles?: string[]; role?: string | null } | null | undefined,
  contextualRole?: string,
): string {
  const route = getRoleHomeRoute(user, contextualRole);
  if (route === ROUTES.admin.overview) return "Về trang quản trị";
  if (route === ROUTES.staff.auctions) return "Về trang vận hành";
  if (route === ROUTES.seller.products) return "Về kênh người bán";
  return "Quay lại trang chủ";
}

function dashboardsForRoles(roles: string[]) {
  const normalizedRoles = new Set(
    roles.map((role) => {
      const normalized = role.toLocaleLowerCase("en-US").replace(/^role_/, "");
      if (normalized === "supportstaff") return "staff";
      if (normalized === "administrator") return "admin";
      return normalized;
    }),
  );

  return roleDashboardLinks.filter((entry) => normalizedRoles.has(entry.role));
}

export function Brand({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  light?: boolean;
}) {
  return <NexusBrandHeader compact={compact} light={light} height={26} />;
}

function AccountNavigation() {
  const { user, clearSession } = useSession();
  const avatarUrl = useResolvedAvatar(user);
  const router = useRouter();
  const displayName =
    user?.displayName ||
    user?.firstName ||
    user?.username ||
    user?.email ||
    "tài khoản";
  const normalizedRoles = getNormalizedRoles(user);
  const isSeller = normalizedRoles.includes("seller");
  const roleInfo = resolveUserRole(user);

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Clear the local session even when the Gateway is unavailable.
    } finally {
      clearSession();
      router.replace(ROUTES.auth.login);
    }
  };

  const buyerItems: AccountMenuItem[] = user
    ? [
        isSeller
          ? { href: ROUTES.seller.shop, label: "Hồ sơ gian hàng & Kho", icon: "warehouse", dividerAfter: true }
          : { href: ROUTES.buyer.becomeSeller, label: "Đăng ký bán hàng", icon: "warehouse", dividerAfter: true },
        { href: ROUTES.buyer.wallet, label: "Ví của tôi", icon: "wallet" },
        { href: ROUTES.buyer.reports, label: "Báo cáo", icon: "flag" },
        { href: ROUTES.auth.profile, label: "Hồ sơ cá nhân", icon: "user" },
        { href: ROUTES.auth.addresses, label: "Sổ địa chỉ", icon: "warehouse" },
        { href: ROUTES.auth.sessions, label: "Phiên đăng nhập", icon: "shield" },
        { href: ROUTES.auth.notificationPreferences, label: "Tuỳ chọn thông báo", icon: "flag" },
        { href: ROUTES.auth.changePassword, label: "Đổi mật khẩu", icon: "shield" },
      ]
    : [];

  return (
    <div className="account-nav">
      {user ? (
        <AccountMenu
          placement="down"
          triggerVariant="avatar"
          displayName={displayName}
          avatarUrl={avatarUrl}
          subtitle={user.email ?? user.username ?? undefined}
          rolePill={roleInfo}
          items={buyerItems}
          onLogout={() => void logout()}
        />
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link className="account-login" href={ROUTES.auth.login}>
            Đăng nhập
          </Link>
          <Link className="button button-small button-secondary" href={ROUTES.auth.register}>
            Đăng ký
          </Link>
        </div>
      )}
    </div>
  );
}

function PortalAccountMenu({ role }: { role: string }) {
  const { user, clearSession } = useSession();
  const avatarUrl = useResolvedAvatar(user);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isSeller = role === "Người bán";
  const notifications = useApiResource(
    isSeller && user?.id ? `notifications:portal:${user.id}` : null,
    async (signal) => (await notificationService.getNotifications(1, 1, false, signal)).pagination.totalCount,
  );
  useEffect(() => {
    if (!isSeller) return;
    window.addEventListener(notificationsChangedEvent, notifications.reload);
    return () => window.removeEventListener(notificationsChangedEvent, notifications.reload);
  }, [isSeller, notifications.reload]);

  const unreadCount = notifications.data ?? 0;
  const unreadLabel = unreadCount > 99 ? "99+" : unreadCount;
  const roleInfo = resolveUserRole(user, role);
  const displayRole = roleInfo?.label ?? role;
  const normalizedRoles = getNormalizedRoles(user);
  const isAdminOrStaff =
    normalizedRoles.includes("admin") ||
    normalizedRoles.includes("administrator") ||
    normalizedRoles.includes("staff") ||
    normalizedRoles.includes("supportstaff") ||
    role.toLocaleLowerCase("en-US").includes("quản trị") ||
    role.toLocaleLowerCase("en-US").includes("nhân viên");
  const canAccessMarketplace = !isAdminOrStaff;
  const displayName =
    user?.displayName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username?.trim() ||
    user?.email ||
    "Tài khoản Nexus";

  async function logout() {
    setBusy(true);
    try {
      await authService.logout();
    } catch {
      // Keep the local session closed if the Gateway is unavailable.
    }
    clearSession();
    router.replace(ROUTES.auth.login);
  }

  const portalItems: AccountMenuItem[] = [];
  if (canAccessMarketplace) {
    portalItems.push({ href: ROUTES.home, label: "Xem sàn thương mại", icon: "bag", highlight: true, dividerAfter: true });
  }
  if (user) {
    portalItems.push(
      { href: ROUTES.auth.profile, label: "Hồ sơ cá nhân", icon: "user" },
      { href: ROUTES.auth.addresses, label: "Sổ địa chỉ", icon: "warehouse" },
      { href: ROUTES.auth.changePassword, label: "Đổi mật khẩu", icon: "shield" },
    );
    if (isSeller) {
      portalItems.push({
        href: ROUTES.seller.notifications,
        label: "Thông báo",
        icon: "bell",
        badge: unreadCount > 0 ? unreadLabel : null,
        ariaLabel: unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo",
      });
    }
  }

  return (
    <div className="portal-account-menu">
      <AccountMenu
        placement="up"
        triggerVariant="sidebar"
        displayName={displayName}
        avatarUrl={avatarUrl}
        subtitle={displayRole}
        items={portalItems}
        onLogout={user ? () => void logout() : undefined}
        logoutBusy={busy}
        loginHref={!user ? ROUTES.auth.login : undefined}
        unreadBadge={unreadCount > 0 ? unreadLabel : null}
        unreadLabel={unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : undefined}
        onOpen={() => { if (isSeller) notifications.reload(); }}
      />
    </div>
  );
}

function BuyerCategoryMenu() {
  const categories = useApiResource("/api/v1/categories", loadCategories);
  return (
    <nav aria-label="Danh mục sản phẩm" className="buyer-category-menu">
      <div className="buyer-category-menu-head">
        <strong>Khám phá danh mục</strong>
        <Link href={ROUTES.catalog.index}>
          Tất cả sản phẩm <Icon name="arrow" size={14} />
        </Link>
      </div>
      {categories.error ? (
        <div className="buyer-category-menu-state" role="alert">
          Không tải được danh mục.{" "}
          <button type="button" onClick={categories.reload}>
            Thử lại
          </button>
        </div>
      ) : categories.loading ? (
        <p className="buyer-category-menu-state" role="status">
          Đang tải danh mục…
        </p>
      ) : categories.data?.length ? (
        <div className="buyer-category-menu-grid">
          {categoryGroups(categories.data).map(({ parent, children }) => (
            <section className="buyer-category-menu-group" key={parent.id}>
              <Link className="buyer-category-menu-parent" href={`${ROUTES.catalog.index}?categoryId=${encodeURIComponent(parent.id)}`}>
                {parent.name}
              </Link>
              {children.length > 0 && (
                <div className="buyer-category-menu-children">
                  {children.map((child) => (
                    <Link key={child.id} href={`${ROUTES.catalog.index}?categoryId=${encodeURIComponent(child.id)}`}>
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <p className="buyer-category-menu-state">Chưa có danh mục.</p>
      )}
    </nav>
  );
}

function BuyerHeaderNav({ isSeller }: { isSeller: boolean }) {
  const enabledBuyerNav = useEnabledNavigation(buyerNavigation);
  const dynamicBuyerNav = enabledBuyerNav.filter((item) => !(item.href === ROUTES.buyer.becomeSeller && isSeller));

  return (
    <div className="buyer-nav-wrap">
      <Suspense fallback={null}>
        <NavLinks
          items={dynamicBuyerNav}
          variant="top"
          ariaLabel="Điều hướng mua sắm"
          catalogMenu={<BuyerCategoryMenu />}
        />
      </Suspense>
    </div>
  );
}

const SiteFooter = memo(function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <Brand compact />
        <p>Copyright 2026</p>
      </div>
      <p>© NEXUS</p>
    </footer>
  );
});

export function BuyerShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const userRoles = user?.roles ?? (user?.role ? [user.role] : []);
  const dashboardLinks = dashboardsForRoles(userRoles);
  const hasPrivilegedRole = dashboardLinks.length > 0;
  const homeHref = getRoleHomeRoute(user);
  const homeLabel = getRoleHomeLabel(user);
  const isSeller = getNormalizedRoles(user).includes("seller");

  return (
    <div className="site-shell buyer-glass-shell">
      <header className="buyer-header">
        <div className="buyer-header-inner">
          <Link href={homeHref} aria-label={`NEXUS - ${homeLabel}`} title={homeLabel}>
            <Brand />
          </Link>
          <form action={ROUTES.catalog.index} method="get" className="header-search">
            <Icon name="search" size={18} />
            <label className="sr-only" htmlFor="site-search">
              Tìm sản phẩm
            </label>
            <input
              id="site-search"
              type="search"
              name="keyword"
              placeholder="Tìm sản phẩm, danh mục…"
            />
            <button type="submit" aria-label="Tìm kiếm">
              <Icon name="arrow" size={17} />
            </button>
          </form>
          <div className="header-actions">
            {hasPrivilegedRole &&
              dashboardLinks.map(({ role, label, href, icon }) => (
                <Link
                  key={role}
                  className="button button-secondary button-small role-dashboard-link"
                  href={href}
                  aria-label={label}
                  title={label}
                >
                  <Icon name={icon} size={18} />
                  <span>{label}</span>
                </Link>
              ))}
            <Link href={ROUTES.buyer.orders}>
              <Icon name="orders" size={19} />
              <span>Đơn mua</span>
            </Link>
            <Link href={ROUTES.buyer.cart}>
              <Icon name="bag" size={19} />
              <span>Giỏ hàng</span>
            </Link>
            <NotificationBell href={ROUTES.buyer.notifications} />
            <AccountNavigation />
          </div>
        </div>
        <BuyerHeaderNav isSeller={isSeller} />
      </header>
      <main id="main-content" className="buyer-main">
        <Suspense fallback={null}>
          <Breadcrumbs />
        </Suspense>
        {children}
      </main>
      <SiteFooter />
      <BackToTop />
    </div>
  );
}

export function PortalShell({
  children,
  role,
  subtitle,
  items,
}: {
  children: ReactNode;
  role: string;
  subtitle: string;
  items: NavigationItem[];
}) {
  const { user } = useSession();
  const roleInfo = resolveUserRole(user, role);
  const displayRole = roleInfo?.label ?? role;
  const portalHomeHref = getRoleHomeRoute(user, role);
  const portalHomeLabel = getRoleHomeLabel(user, role);

  return (
    <div className={`portal-shell${role === "Nhân viên" || role === "Quản trị viên" ? " portal-shell-operations" : ""}`}>
      <aside className="portal-sidebar">
        <div className="sidebar-brand">
          <Link
            href={portalHomeHref}
            aria-label={`NEXUS - ${portalHomeLabel}`}
            title={portalHomeLabel}
            style={{ display: "inline-flex", textDecoration: "none" }}
          >
            <Brand />
          </Link>
        </div>
        <p className="sidebar-label">{subtitle}</p>
        <Suspense fallback={null}>
          <NavLinks items={items} />
        </Suspense>
        <PortalAccountMenu role={role} />
      </aside>
      <div className="portal-column">
        <details className="mobile-menu">
          <summary>
            <Brand compact />
            <span>Menu {displayRole}</span>
            <Icon name="chevronDown" size={16} />
          </summary>
          <div className="mobile-menu-panel">
            <Suspense fallback={null}>
              <NavLinks items={items} />
            </Suspense>
            <PortalAccountMenu role={role} />
          </div>
        </details>
        <main id="main-content" className="portal-main">
          <Suspense fallback={null}>
            <Breadcrumbs portal />
          </Suspense>
          {children}
        </main>
      </div>
      <BackToTop />
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();

  const isFullScreenAuth =
    pathname === ROUTES.auth.login ||
    pathname === ROUTES.auth.register ||
    Boolean(pathname?.startsWith(ROUTES.auth.forgotPassword)) ||
    Boolean(pathname?.startsWith(ROUTES.auth.resetPassword));

  if (isFullScreenAuth) {
    return <>{children}</>;
  }

  const homeHref = getRoleHomeRoute(user);
  const homeLabel = getRoleHomeLabel(user);

  return (
    <div className="auth-shell">
      <header className="auth-header">
        <Link href={homeHref} aria-label={`NEXUS - ${homeLabel}`} title={homeLabel}>
          <Brand />
        </Link>
        <Link className="auth-home" href={homeHref}>
          {homeLabel}
        </Link>
      </header>
      <main className="auth-main">{children}</main>
      <footer className="auth-footer">
        <span>© NEXUS</span>
        <span>Điều khoản dịch vụ　·　Chính sách bảo mật</span>
      </footer>
    </div>
  );
}
