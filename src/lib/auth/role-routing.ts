import { ROUTES } from "@/constants/routes";

export type RoleBearingUser = {
  roles?: string[];
  role?: string | null;
} | null | undefined;

export type PrimaryPortalRole = "admin" | "staff" | "seller" | "buyer";

export function normalizeRoleKey(role: string): string {
  const normalized = role.toLocaleLowerCase("en-US").replace(/^role_/, "").replace(/[\s_-]+/g, "");
  if (normalized === "administrator") return "admin";
  if (normalized === "supportstaff") return "staff";
  if (normalized === "customer") return "buyer";
  return normalized;
}

export function getNormalizedUserRoles(user: RoleBearingUser): string[] {
  const rawRoles = user?.roles?.length
    ? user.roles
    : user?.role
      ? [user.role]
      : [];
  return [...new Set(rawRoles.map(normalizeRoleKey).filter(Boolean))];
}

/**
 * Resolves the user's primary portal role with strict precedence:
 * Admin > Staff > Seller > Buyer.
 */
export function getPrimaryPortalRole(user: RoleBearingUser): PrimaryPortalRole | null {
  if (!user) return null;
  const roles = getNormalizedUserRoles(user);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("staff")) return "staff";
  if (roles.includes("seller")) return "seller";
  if (roles.includes("buyer")) return "buyer";
  return "buyer";
}

export function isAdminOrStaffUser(user: RoleBearingUser): boolean {
  const primary = getPrimaryPortalRole(user);
  return primary === "admin" || primary === "staff";
}

export function getLandingPathForUser(user: RoleBearingUser): string {
  const primary = getPrimaryPortalRole(user);
  if (primary === "admin") return ROUTES.admin.overview;
  if (primary === "staff") return ROUTES.staff.auctions;
  if (primary === "seller") return ROUTES.seller.products;
  return ROUTES.home;
}

export function getPortalHomeRoute(user: RoleBearingUser, contextualRole?: string): string {
  const primary = getPrimaryPortalRole(user);
  // Admin and Staff stay strictly locked to their dedicated portal home regardless of surrounding context.
  if (primary === "admin") return ROUTES.admin.overview;
  if (primary === "staff") return ROUTES.staff.auctions;

  if (contextualRole) {
    const ctx = contextualRole.toLocaleLowerCase("en-US");
    if (ctx.includes("quản trị") || ctx.includes("admin")) return ROUTES.admin.overview;
    if (ctx.includes("nhân viên") || ctx.includes("staff")) return ROUTES.staff.auctions;
    if (ctx.includes("bán") || ctx.includes("seller")) return ROUTES.seller.products;
  }

  return ROUTES.home;
}

export function hasStrictPortalAccess(user: RoleBearingUser, allowedRoles: readonly string[]): boolean {
  if (!user) return false;
  const normalizedAllowed = allowedRoles.map(normalizeRoleKey);
  const primary = getPrimaryPortalRole(user);

  // Strict separation: Admin can only enter Admin routes (or shared account routes explicitly allowing Admin),
  // never Staff, Seller, or Buyer routes. Likewise Staff cannot enter Admin, Seller, or Buyer routes.
  if (primary === "admin") {
    return normalizedAllowed.includes("admin");
  }
  if (primary === "staff") {
    return normalizedAllowed.includes("staff");
  }

  const roles = getNormalizedUserRoles(user);
  return roles.some((role) => normalizedAllowed.includes(role));
}

function isAccountRoute(path: string): boolean {
  return path === "/account" || path.startsWith("/account/");
}

function isAdminRoute(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

function isStaffRoute(path: string): boolean {
  return path === "/staff" || path.startsWith("/staff/");
}

function isSellerRoute(path: string): boolean {
  return path === "/seller" || path.startsWith("/seller/");
}

function isBuyerRoute(path: string): boolean {
  return path === "/buyer" || path.startsWith("/buyer/");
}

export function resolveSafeReturnPath(value: string | null, user: RoleBearingUser): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  const path = value.split(/[?#]/, 1)[0];
  const primary = getPrimaryPortalRole(user);
  const roles = getNormalizedUserRoles(user);

  if (primary === "admin") {
    return isAdminRoute(path) || isAccountRoute(path) ? value : null;
  }
  if (primary === "staff") {
    return isStaffRoute(path) || isAccountRoute(path) ? value : null;
  }

  if (isAdminRoute(path) || isStaffRoute(path)) return null;
  if (isSellerRoute(path) && !roles.includes("seller")) return null;
  if (isBuyerRoute(path) && !roles.some((role) => role === "buyer" || role === "seller")) return null;
  return value;
}
