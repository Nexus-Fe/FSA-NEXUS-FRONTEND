import { formatMoney } from "@/lib/presentation";
import type { DiscountScopeType, DiscountType } from "./services/discount.service";
import { canSelectVoucher } from "./voucher-rules";

export type VoucherCartItemInput = {
  sellerId: string;
  quantity: number;
  unitPriceSnapshot: number;
};

export type VoucherCalcInput = {
  code: string;
  scopeType: DiscountScopeType;
  ownerSellerId?: string | null;
  discountType?: DiscountType;
  discountValue?: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number | null;
  estimatedDiscountAmount: number;
};

export type CheckoutDiscountEstimate = {
  itemsAmount: number;
  productDiscount: number;
  shopDiscount: number;
  systemDiscount: number;
  totalDiscount: number;
  finalItemsAmount: number;
  productCodes: string[];
  shopCodes: string[];
  systemCodes: string[];
  warnings: Array<{ code: string; reason: string }>;
};

function computeTierDiscount(baseAmount: number, voucher: VoucherCalcInput): number {
  if (baseAmount <= 0) return 0;
  if (typeof voucher.discountValue === "number" && voucher.discountType) {
    let discount =
      voucher.discountType === "Percentage"
        ? Math.round((baseAmount * voucher.discountValue) / 100)
        : voucher.discountValue;
    if (
      typeof voucher.maxDiscountAmount === "number" &&
      voucher.maxDiscountAmount > 0 &&
      discount > voucher.maxDiscountAmount
    ) {
      discount = voucher.maxDiscountAmount;
    }
    return Math.min(Math.max(0, discount), baseAmount);
  }
  return Math.min(Math.max(0, voucher.estimatedDiscountAmount), baseAmount);
}

/**
 * Mirrors backend VoucherCalculationEngine tier order:
 * 1. Product vouchers first (per shop/item scope)
 * 2. Shop vouchers second (on remaining shop items amount)
 * 3. System voucher last (on remaining total items amount)
 */
export function estimateCheckoutDiscounts(
  items: VoucherCartItemInput[],
  selectedVouchers: VoucherCalcInput[],
): CheckoutDiscountEstimate {
  const remainingByShop = new Map<string, number>();
  let itemsAmount = 0;

  for (const item of items) {
    const line = Math.max(0, item.unitPriceSnapshot * item.quantity);
    itemsAmount += line;
    const key = (item.sellerId ?? "").toLowerCase();
    remainingByShop.set(key, (remainingByShop.get(key) ?? 0) + line);
  }

  let productDiscount = 0;
  let shopDiscount = 0;
  let systemDiscount = 0;
  const productCodes: string[] = [];
  const shopCodes: string[] = [];
  const systemCodes: string[] = [];
  const warnings: Array<{ code: string; reason: string }> = [];

  const productVouchers = selectedVouchers.filter((v) => v.scopeType === "Product");
  const shopVouchers = selectedVouchers.filter((v) => v.scopeType === "Shop");
  const systemVouchers = selectedVouchers.filter((v) => v.scopeType === "System");

  // Tier 1: Product vouchers first
  for (const pv of productVouchers) {
    productCodes.push(pv.code);
    const sellerKey = pv.ownerSellerId?.toLowerCase();
    if (sellerKey && remainingByShop.has(sellerKey)) {
      const shopRemaining = remainingByShop.get(sellerKey) ?? 0;
      const discount = Math.min(Math.max(0, pv.estimatedDiscountAmount), shopRemaining);
      productDiscount += discount;
      remainingByShop.set(sellerKey, Math.max(0, shopRemaining - discount));
    } else {
      const globalRemaining = Math.max(0, itemsAmount - productDiscount);
      const discount = Math.min(Math.max(0, pv.estimatedDiscountAmount), globalRemaining);
      productDiscount += discount;
    }
  }

  // Tier 2: Shop vouchers second (on remaining amount after product discount)
  for (const sv of shopVouchers) {
    shopCodes.push(sv.code);
    const sellerKey = sv.ownerSellerId?.toLowerCase();
    if (sellerKey && remainingByShop.has(sellerKey)) {
      const shopRemaining = remainingByShop.get(sellerKey) ?? 0;
      if (typeof sv.minOrderAmount === "number" && shopRemaining < sv.minOrderAmount) {
        warnings.push({
          code: sv.code,
          reason: `Sau khi trừ mã sản phẩm, đơn của shop còn ${formatMoney(shopRemaining)}, chưa đạt mức tối thiểu ${formatMoney(sv.minOrderAmount)} cho mã ${sv.code}.`,
        });
        continue;
      }
      const discount = computeTierDiscount(shopRemaining, sv);
      shopDiscount += discount;
      remainingByShop.set(sellerKey, Math.max(0, shopRemaining - discount));
    } else {
      const globalRemaining = Math.max(0, itemsAmount - productDiscount - shopDiscount);
      const discount = computeTierDiscount(globalRemaining, sv);
      shopDiscount += discount;
    }
  }

  // Tier 3: System voucher last (on remaining amount after product & shop discounts)
  const remainingSystemBase = Math.max(0, itemsAmount - productDiscount - shopDiscount);
  for (const sys of systemVouchers.slice(0, 1)) {
    systemCodes.push(sys.code);
    if (typeof sys.minOrderAmount === "number" && remainingSystemBase < sys.minOrderAmount) {
      warnings.push({
        code: sys.code,
        reason: `Sau khi trừ mã sản phẩm/shop, tiền hàng còn ${formatMoney(remainingSystemBase)}, chưa đạt mức tối thiểu ${formatMoney(sys.minOrderAmount)} cho mã ${sys.code}.`,
      });
      continue;
    }
    const discount = computeTierDiscount(remainingSystemBase, sys);
    systemDiscount += discount;
  }

  const totalDiscount = Math.min(itemsAmount, productDiscount + shopDiscount + systemDiscount);
  const finalItemsAmount = Math.max(0, itemsAmount - totalDiscount);

  return {
    itemsAmount,
    productDiscount,
    shopDiscount,
    systemDiscount,
    totalDiscount,
    finalItemsAmount,
    productCodes,
    shopCodes,
    systemCodes,
    warnings,
  };
}

/**
 * Checks whether adding `candidate` to `selectedVouchers` causes a scope conflict,
 * COD platform restriction, or breaks any tier minimum-order condition symmetrically.
 */
export function validateVoucherCombination(
  items: VoucherCartItemInput[],
  selectedVouchers: VoucherCalcInput[],
  candidate: VoucherCalcInput,
  cashOnDelivery = false,
): string | null {
  const normalizedCode = candidate.code.toUpperCase();
  if (selectedVouchers.some((v) => v.code.toUpperCase() === normalizedCode)) {
    return null;
  }
  if (cashOnDelivery && candidate.scopeType === "System") {
    return "Mã của sàn không dùng được khi thanh toán khi nhận hàng (COD).";
  }
  const conflict = canSelectVoucher(selectedVouchers, candidate);
  if (conflict) {
    return conflict;
  }
  if (items.length > 0) {
    const simulated = estimateCheckoutDiscounts(items, [...selectedVouchers, candidate]);
    if (simulated.warnings.length > 0) {
      return simulated.warnings[0].reason;
    }
  }
  return null;
}
