"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AdminPagination, Badge, Card, NoData, PageHeading, TruncatedText } from "@/components/ui/Primitives";
import { CopyableId } from "@/components/ui/CopyableId";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SelectBox, type SelectBoxOption } from "@/components/ui/SelectBox";
import type { PublicSellerSummary } from "@/features/catalog/services/catalog.service";
import { ROUTES } from "@/constants/routes";
import {
  fulfillmentService,
  shipmentStatusLabel,
  shipmentStatusTone,
  ShipmentTimelineList,
  type PagedShipments,
  type ShipmentDetail,
  type SubOrderShipment,
} from "@/features/fulfillment";
import { useApiResource } from "@/lib/api/use-api-resource";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { formatMoney } from "@/lib/presentation";
import { ORDER_STATUS, SUB_ORDER_STATUS, normalizeStatus, semanticStatusTone, statusLabel } from "@/lib/status-labels";
import { BuyerDetailModal, OrderSubOrderDetailModal, SellerDetailModal } from "./components/AdminShipmentModals";
import {
  adminShipmentsService,
  type AdminAuctionOrderDetail,
  type AdminOrderDetail,
  type AdminSubOrderDetail,
  type WarehouseDetail,
} from "./services/admin-shipments.service";
import type { AdminUser } from "./services/admin-users.service";
import "./AdminShipmentsScreen.css";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type GhnSimOption = {
  value: string;
  label: string;
  group: "Luồng giao hàng chính" | "Xử lý ngoại lệ & hoàn hủy";
  targetEnum: string;
  description: string;
};

const GHN_SIMULATE_STATUS_OPTIONS: readonly GhnSimOption[] = [
  {
    value: "picking",
    label: "Đang lấy hàng (picking)",
    group: "Luồng giao hàng chính",
    targetEnum: "Picking",
    description: "Bưu tá GHN đang trên đường tới kho người bán để nhận bưu kiện.",
  },
  {
    value: "storing",
    label: "Đã đóng gói / Nhập kho GHN (storing)",
    group: "Luồng giao hàng chính",
    targetEnum: "Packed",
    description: "Bưu kiện đã được đóng gói hoặc nhập kho phân loại GHN.",
  },
  {
    value: "picked",
    label: "Đã lấy hàng / Bàn giao (picked)",
    group: "Luồng giao hàng chính",
    targetEnum: "HandedOver",
    description: "Bưu tá GHN đã nhận hàng từ người bán. Hệ thống tự động chuyển SubOrder sang 'Đang giao'.",
  },
  {
    value: "delivering",
    label: "Đang giao hàng (delivering)",
    group: "Luồng giao hàng chính",
    targetEnum: "InTransit",
    description: "Bưu tá GHN đang trên đường vận chuyển tới người nhận.",
  },
  {
    value: "delivered",
    label: "Giao thành công (delivered)",
    group: "Luồng giao hàng chính",
    targetEnum: "Delivered",
    description: "Giao hàng thành công. SubOrder chuyển sang 'Đã giao' và cho phép người mua xác nhận hoàn tất.",
  },
  {
    value: "delivery_fail",
    label: "Giao thất bại (delivery_fail)",
    group: "Xử lý ngoại lệ & hoàn hủy",
    targetEnum: "DeliveryFailed",
    description: "Khách hẹn lại ngày giao hoặc không liên lạc được. Hỗ trợ ghi nhận nhiều lần giao thất bại liên tiếp.",
  },
  {
    value: "returning",
    label: "Đang chuyển hoàn (returning)",
    group: "Xử lý ngoại lệ & hoàn hủy",
    targetEnum: "Returning",
    description: "Hàng đang được đơn vị vận chuyển gửi trả về kho người bán.",
  },
  {
    value: "returned",
    label: "Đã trả hàng hoàn (returned)",
    group: "Xử lý ngoại lệ & hoàn hủy",
    targetEnum: "Returned",
    description: "Người bán nhận lại hàng hoàn. Tự động phục hồi tồn kho và hoàn tiền ví (nếu đã thanh toán).",
  },
  {
    value: "cancel",
    label: "Hủy vận đơn (cancel)",
    group: "Xử lý ngoại lệ & hoàn hủy",
    targetEnum: "Cancelled",
    description: "Hủy bỏ yêu cầu giao vận trên hệ thống GHN.",
  },
];

const SHIPMENT_STATUS_ORDER: Record<string, number> = {
  READYTOPICK: 0,
  PICKING: 1,
  PACKED: 2,
  HANDEDOVER: 3,
  INTRANSIT: 4,
  DELIVERED: 5,
  DELIVERYFAILED: 6,
  RETURNED: 7,
  CANCELLED: 8,
  RETURNING: 9,
};

function isValidTransition(currentStatus: string | null | undefined, targetEnum: string, force: boolean): boolean {
  if (force || !currentStatus) return true;
  const cur = normalizeStatus(currentStatus);
  const next = normalizeStatus(targetEnum);

  if (cur === next) {
    return cur === "DELIVERYFAILED" && next === "DELIVERYFAILED";
  }
  if (cur === "RETURNED" || cur === "CANCELLED") return false;
  if (cur === "DELIVERED") return next === "RETURNED";
  if (next === "RETURNING") {
    return cur === "HANDEDOVER" || cur === "INTRANSIT" || cur === "DELIVERYFAILED";
  }
  if (cur === "RETURNING") {
    return next === "RETURNED" || next === "CANCELLED";
  }
  if (cur === "DELIVERYFAILED") {
    return next === "INTRANSIT" || next === "DELIVERED" || next === "RETURNED" || next === "CANCELLED";
  }
  const curOrder = SHIPMENT_STATUS_ORDER[cur];
  const nextOrder = SHIPMENT_STATUS_ORDER[next];
  if (curOrder === undefined || nextOrder === undefined) return true;
  return nextOrder > curOrder;
}

type NextStepAction = {
  value: string;
  label: string;
  description: string;
};

function resolveNextStep(currentStatus: string | null | undefined): NextStepAction | null {
  const cur = normalizeStatus(currentStatus);
  if (cur === "READYTOPICK") {
    return { value: "picking", label: "Đang lấy hàng (picking)", description: "Bưu tá GHN đang tới kho người bán để nhận bưu kiện." };
  }
  if (cur === "PICKING") {
    return { value: "storing", label: "Nhập kho / Đóng gói (storing)", description: "Bưu kiện đã nhập kho phân loại GHN." };
  }
  if (cur === "PACKED") {
    return { value: "picked", label: "Bàn giao GHN (picked)", description: "Bưu tá đã nhận hàng, chuyển SubOrder sang Đang giao." };
  }
  if (cur === "HANDEDOVER") {
    return { value: "delivering", label: "Đang giao hàng (delivering)", description: "Bưu tá đang giao hàng tới người nhận." };
  }
  if (cur === "INTRANSIT") {
    return { value: "delivered", label: "Giao thành công (delivered)", description: "Giao hàng thành công tới người nhận." };
  }
  if (cur === "DELIVERYFAILED") {
    return { value: "delivering", label: "Thử giao lại (delivering)", description: "Bưu tá thực hiện giao lại đơn hàng cho khách." };
  }
  if (cur === "RETURNING") {
    return { value: "returned", label: "Đã trả hàng hoàn (returned)", description: "Người bán đã nhận lại hàng chuyển hoàn." };
  }
  return null;
}

type LifecycleMilestone = {
  key: string;
  label: string;
  subLabel: string;
  icon: IconName;
};

const LIFECYCLE_MILESTONES: readonly LifecycleMilestone[] = [
  { key: "ready", label: "Chờ lấy hàng", subLabel: "ready_to_pick", icon: "clock" },
  { key: "picking", label: "Lấy & Nhập kho", subLabel: "picking / storing", icon: "package" },
  { key: "handed", label: "Đã bàn giao GHN", subLabel: "picked", icon: "checkSquare" },
  { key: "transit", label: "Đang giao hàng", subLabel: "delivering", icon: "truck" },
  { key: "delivered", label: "Giao thành công", subLabel: "delivered", icon: "packageCheck" },
];

function resolveMilestoneState(status: string | null | undefined): {
  activeIndex: number;
  isException: boolean;
  exceptionText: string;
} {
  const cur = normalizeStatus(status);
  if (cur === "READYTOPICK") return { activeIndex: 0, isException: false, exceptionText: "" };
  if (cur === "PICKING" || cur === "PACKED") return { activeIndex: 1, isException: false, exceptionText: "" };
  if (cur === "HANDEDOVER") return { activeIndex: 2, isException: false, exceptionText: "" };
  if (cur === "INTRANSIT") return { activeIndex: 3, isException: false, exceptionText: "" };
  if (cur === "DELIVERED") return { activeIndex: 4, isException: false, exceptionText: "" };
  if (cur === "DELIVERYFAILED") {
    return {
      activeIndex: 3,
      isException: true,
      exceptionText: "Giao thất bại — có thể bấm 'Thử giao lại', ghi nhận thêm 'delivery_fail' hoặc chuyển sang 'returning'.",
    };
  }
  if (cur === "RETURNING") {
    return {
      activeIndex: 3,
      isException: true,
      exceptionText: "Đang chuyển hoàn về kho người bán — bước kế tiếp là xác nhận đã trả hàng (returned).",
    };
  }
  if (cur === "RETURNED") {
    return { activeIndex: 4, isException: true, exceptionText: "Đã hoàn hàng về người bán (trạng thái kết thúc)." };
  }
  if (cur === "CANCELLED") {
    return { activeIndex: 0, isException: true, exceptionText: "Vận đơn đã bị hủy (trạng thái kết thúc)." };
  }
  return { activeIndex: 0, isException: false, exceptionText: "" };
}

const SHIPMENT_FILTER_STATUS_OPTIONS = [
  { value: "ReadyToPick", label: "Chờ lấy hàng" },
  { value: "Picking", label: "Đang lấy hàng" },
  { value: "Packed", label: "Đã đóng gói" },
  { value: "HandedOver", label: "Đã bàn giao" },
  { value: "InTransit", label: "Đang vận chuyển" },
  { value: "Delivered", label: "Đã giao" },
  { value: "DeliveryFailed", label: "Giao lỗi" },
  { value: "Returning", label: "Đang hoàn hàng" },
  { value: "Returned", label: "Đã hoàn hàng" },
  { value: "Cancelled", label: "Đã hủy" },
] as const;

type SortOptionValue = "createdAt:desc" | "createdAt:asc" | "updatedAt:desc" | "updatedAt:asc";

const SORT_OPTIONS: Array<{
  value: SortOptionValue;
  label: string;
  sortBy: "createdAt" | "updatedAt";
  sortOrder: "asc" | "desc";
}> = [
  { value: "createdAt:desc", label: "Mới nhất (Ngày tạo ↓)", sortBy: "createdAt", sortOrder: "desc" },
  { value: "createdAt:asc", label: "Cũ nhất (Ngày tạo ↑)", sortBy: "createdAt", sortOrder: "asc" },
  { value: "updatedAt:desc", label: "Cập nhật gần nhất (↓)", sortBy: "updatedAt", sortOrder: "desc" },
  { value: "updatedAt:asc", label: "Cập nhật lâu nhất (↑)", sortBy: "updatedAt", sortOrder: "asc" },
];

const PRINT_SIZE_OPTIONS: readonly SelectBoxOption[] = [
  { value: "A5", label: "Khổ A5" },
  { value: "80x80", label: "Khổ 80x80 (Nhiệt)" },
  { value: "52x70", label: "Khổ 52x70" },
];

type ActiveModalState =
  | { type: "seller"; tab: "account" | "warehouse" }
  | { type: "buyer" }
  | { type: "suborder"; targetId: string }
  | { type: "order"; targetId: string }
  | null;

type EnrichedShipmentContext = {
  warehouseDetail: WarehouseDetail | null;
  subOrderDetail: AdminSubOrderDetail | null;
  masterOrderDetail: AdminOrderDetail | null;
  auctionOrderDetail: AdminAuctionOrderDetail | null;
  sellerAccount: AdminUser | null;
  sellerPublic: PublicSellerSummary | null;
  buyerAccount: AdminUser | null;
  skuProductMap: Record<string, string>;
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN");
}

function getLatestEventTime(shipment: ShipmentDetail): string | null {
  if (!shipment.events?.length) return null;
  const sorted = [...shipment.events].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  return sorted[0]?.occurredAt ?? null;
}

function getShipmentCodeKey(shipment: ShipmentDetail): string {
  return shipment.trackingNumber ?? shipment.subOrderNo ?? shipment.orderId ?? shipment.id;
}

function readInitialQueryParams(): { code: string; modal: string; targetId: string; tab: "account" | "warehouse" } {
  if (typeof window === "undefined") {
    return { code: "", modal: "", targetId: "", tab: "account" };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    code: params.get("code")?.trim() ?? "",
    modal: params.get("modal")?.trim() ?? "",
    targetId: params.get("targetId")?.trim() ?? "",
    tab: params.get("tab") === "warehouse" ? "warehouse" : "account",
  };
}

export function AdminShipmentsScreen() {
  const [inputCode, setInputCode] = useState(() => readInitialQueryParams().code);
  const [selectedStatus, setSelectedStatus] = useState("picked");
  const [shipperName, setShipperName] = useState("Nguyễn Văn Shipper");
  const [shipperPhone, setShipperPhone] = useState("0901234567");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [force, setForce] = useState(false);

  const [lookupLoading, setLookupLoading] = useState(() => Boolean(readInitialQueryParams().code));
  const [submitting, setSubmitting] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [printPageSize, setPrintPageSize] = useState<"A5" | "80x80" | "52x70">("A5");

  const [activeShipment, setActiveShipment] = useState<ShipmentDetail | null>(null);
  const [masterOrderShipments, setMasterOrderShipments] = useState<SubOrderShipment[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [modalState, setModalState] = useState<ActiveModalState>(null);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOptionValue>("createdAt:desc");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const hydratedRef = useRef(false);

  const activeSort = SORT_OPTIONS.find((s) => s.value === sortOption) ?? SORT_OPTIONS[0];
  const statusQuery = selectedStatuses.join(",");

  const shipmentsResource = useApiResource(
    `admin-shipments:${page}:${appliedSearch}:${statusQuery}:${sortOption}:${refreshTrigger}`,
    (signal) =>
      fulfillmentService.listShipments(
        {
          page,
          pageSize: 10,
          search: appliedSearch || undefined,
          status: statusQuery || undefined,
          sortBy: activeSort.sortBy,
          sortOrder: activeSort.sortOrder,
        },
        signal,
      ),
  );

  const contextResource = useApiResource<EnrichedShipmentContext>(
    activeShipment ? `admin-shipment-ctx:${activeShipment.id}:${activeShipment.updatedAt ?? ""}` : null,
    async (signal) => {
      const shipment = activeShipment!;
      const [whRes, subRes] = await Promise.all([
        shipment.warehouseId
          ? adminShipmentsService.getWarehouseById(shipment.warehouseId, signal).catch(() => null)
          : Promise.resolve(null),
        shipment.orderId
          ? adminShipmentsService.getSubOrderDetail(shipment.orderId, signal).catch(() => null)
          : Promise.resolve(null),
      ]);

      let aoRes: AdminAuctionOrderDetail | null = null;
      if (!subRes && shipment.orderId) {
        aoRes = await adminShipmentsService.getAuctionOrderDetail(shipment.orderId, signal);
      }

      const skuMap: Record<string, string> = {};
      if (subRes?.items) {
        for (const item of subRes.items) {
          if (item.skuId && item.productId) {
            skuMap[item.skuId] = item.productId;
          }
        }
      }
      if (aoRes?.skuId && aoRes?.productId) {
        skuMap[aoRes.skuId] = aoRes.productId;
      }

      const missingSkus = (shipment.items ?? [])
        .map((i) => i.skuId)
        .filter((skuId) => skuId && !skuMap[skuId]);
      if (missingSkus.length > 0) {
        const resolvedIds = await Promise.all(
          missingSkus.map(async (skuId) => ({
            skuId,
            productId: await adminShipmentsService.getVariantProductId(skuId, signal),
          })),
        );
        for (const entry of resolvedIds) {
          if (entry.productId) skuMap[entry.skuId] = entry.productId;
        }
      }

      const sellerId = subRes?.sellerId ?? aoRes?.sellerId ?? whRes?.sellerId ?? null;
      const buyerId = subRes?.buyerId ?? aoRes?.buyerId ?? shipment.buyerId ?? null;
      const parentOrderId = subRes?.orderId ?? null;

      const [sellerAcc, sellerPub, buyerAcc, orderRes] = await Promise.all([
        sellerId ? adminShipmentsService.getAdminUserDetail(sellerId, signal) : Promise.resolve(null),
        sellerId ? adminShipmentsService.getPublicSellerProfile(sellerId, signal) : Promise.resolve(null),
        buyerId ? adminShipmentsService.getAdminUserDetail(buyerId, signal) : Promise.resolve(null),
        parentOrderId ? adminShipmentsService.getOrderDetail(parentOrderId, signal).catch(() => null) : Promise.resolve(null),
      ]);

      return {
        warehouseDetail: whRes,
        subOrderDetail: subRes,
        masterOrderDetail: orderRes,
        auctionOrderDetail: aoRes,
        sellerAccount: sellerAcc,
        sellerPublic: sellerPub,
        buyerAccount: buyerAcc,
        skuProductMap: skuMap,
      };
    },
  );

  const resolveShipmentByAnyCode = useCallback(
    async (rawCode: string): Promise<{ shipment: ShipmentDetail | null; masterShipments: SubOrderShipment[] }> => {
      const code = rawCode.trim();
      if (!code) return { shipment: null, masterShipments: [] };

      try {
        const direct = await fulfillmentService.getShipmentByTracking(code);
        return { shipment: direct, masterShipments: [] };
      } catch {
        // Continue
      }

      if (UUID_REGEX.test(code)) {
        try {
          const bySub = await fulfillmentService.getShipmentBySubOrderId(code);
          return { shipment: bySub, masterShipments: [] };
        } catch {
          // Continue
        }

        try {
          const byOrder = await fulfillmentService.listShipments({ orderId: code, page: 1, pageSize: 1 });
          if (byOrder.items.length > 0) return { shipment: byOrder.items[0], masterShipments: [] };
        } catch {
          // Continue
        }

        try {
          const masterTracking = await fulfillmentService.getOrderTracking(code);
          const subs = masterTracking.shipments ?? [];
          if (subs.length > 0) {
            const firstWithCode = subs.find((s) => s.trackingCode) ?? subs[0];
            const lookupKey = firstWithCode.trackingCode ?? firstWithCode.subOrderId;
            try {
              const firstShipment = await fulfillmentService.getShipmentByTracking(lookupKey);
              return { shipment: firstShipment, masterShipments: subs };
            } catch {
              const listRes = await fulfillmentService.listShipments({
                orderId: firstWithCode.subOrderId,
                page: 1,
                pageSize: 1,
              });
              if (listRes.items.length > 0) return { shipment: listRes.items[0], masterShipments: subs };
            }
          }
        } catch {
          // Fall through
        }
      }

      try {
        const searchRes = await fulfillmentService.listShipments({ search: code, page: 1, pageSize: 5 });
        if (searchRes.items.length > 0) return { shipment: searchRes.items[0], masterShipments: [] };
      } catch {
        // No match
      }

      return { shipment: null, masterShipments: [] };
    },
    [],
  );

  const syncUrlState = useCallback((shipment: ShipmentDetail | null, modal: ActiveModalState) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (shipment) {
      params.set("code", getShipmentCodeKey(shipment));
    } else {
      params.delete("code");
    }

    if (modal) {
      params.set("modal", modal.type);
      if (modal.type === "suborder" || modal.type === "order") {
        params.set("targetId", modal.targetId);
      } else {
        params.delete("targetId");
      }
      if (modal.type === "seller") {
        params.set("tab", modal.tab);
      } else {
        params.delete("tab");
      }
    } else {
      params.delete("modal");
      params.delete("targetId");
      params.delete("tab");
    }

    const qs = params.toString();
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    syncUrlState(activeShipment, modalState);
  }, [activeShipment, modalState, syncUrlState]);

  useEffect(() => {
    const initial = readInitialQueryParams();
    if (!initial.code) {
      hydratedRef.current = true;
      return;
    }

    let active = true;
    resolveShipmentByAnyCode(initial.code)
      .then(({ shipment, masterShipments }) => {
        if (!active) return;
        if (masterShipments.length > 0) {
          setMasterOrderShipments(masterShipments);
        }
        if (shipment) {
          setActiveShipment(shipment);
          setInputCode(getShipmentCodeKey(shipment));
          if (initial.modal === "seller") {
            setModalState({ type: "seller", tab: initial.tab });
          } else if (initial.modal === "buyer") {
            setModalState({ type: "buyer" });
          } else if (initial.modal === "suborder") {
            setModalState({ type: "suborder", targetId: initial.targetId || shipment.orderId });
          } else if (initial.modal === "order" && initial.targetId) {
            setModalState({ type: "order", targetId: initial.targetId });
          }
        }
      })
      .finally(() => {
        if (active) {
          setLookupLoading(false);
          hydratedRef.current = true;
        }
      });

    return () => {
      active = false;
    };
  }, [resolveShipmentByAnyCode]);

  const effectiveSelectedStatus = useMemo(() => {
    if (!activeShipment || force) return selectedStatus;
    const currentOpt = GHN_SIMULATE_STATUS_OPTIONS.find((opt) => opt.value === selectedStatus);
    if (currentOpt && isValidTransition(activeShipment.status, currentOpt.targetEnum, false)) {
      return selectedStatus;
    }
    return resolveNextStep(activeShipment.status)?.value ?? selectedStatus;
  }, [activeShipment, force, selectedStatus]);

  async function handleLookup(codeToSearch?: string) {
    const code = (codeToSearch ?? inputCode).trim();
    if (!code) {
      setErrorMessage("Vui lòng nhập mã vận đơn GHN, SubOrder ID hoặc Order ID để tra cứu.");
      return;
    }
    setLookupLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    setMasterOrderShipments([]);
    setModalState(null);
    try {
      const { shipment, masterShipments } = await resolveShipmentByAnyCode(code);
      setMasterOrderShipments(masterShipments);
      if (!shipment) {
        setActiveShipment(null);
        setErrorMessage(`Không tìm thấy vận đơn nào khớp với mã "${code}".`);
        return;
      }
      setActiveShipment(shipment);
      setInputCode(getShipmentCodeKey(shipment));
    } catch (cause) {
      setActiveShipment(null);
      setErrorMessage(
        cause instanceof Error && cause.message
          ? cause.message
          : `Không tìm thấy vận đơn nào khớp với mã "${code}".`,
      );
    } finally {
      setLookupLoading(false);
    }
  }

  async function executeSimulateStatus(targetStatusValue: string, customDesc?: string) {
    const tracking = inputCode.trim();
    if (!tracking) {
      setErrorMessage("Vui lòng nhập mã vận đơn GHN hoặc SubOrder ID để cập nhật trạng thái.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const selectedOption = GHN_SIMULATE_STATUS_OPTIONS.find((opt) => opt.value === targetStatusValue);
      const desc = customDesc?.trim() || selectedOption?.description || `Mô phỏng trạng thái ${targetStatusValue}`;

      const res = await fulfillmentService.simulateShipperStatus({
        trackingNumber: tracking,
        status: targetStatusValue,
        description: desc,
        shipperName: shipperName.trim() || "Nguyễn Văn Shipper",
        shipperPhone: shipperPhone.trim() || "0901234567",
        reason: reason.trim() || undefined,
        force,
      });

      setSuccessMessage(
        `Cập nhật trạng thái thành công! Trạng thái vận đơn: "${shipmentStatusLabel(res.currentStatus ?? res.newStatus)}". ${
          res.commerceStatusNotified ? `Đã đồng bộ sang Commerce (${res.commerceStatusNotified}).` : ""
        }`,
      );

      setRefreshTrigger((v) => v + 1);
      const { shipment: updated } = await resolveShipmentByAnyCode(res.trackingNumber || tracking);
      if (updated) {
        setActiveShipment(updated);
      }
    } catch (cause) {
      setErrorMessage(formatError(describeError(cause, { operation: "write" })));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSimulateSubmit(event: FormEvent) {
    event.preventDefault();
    await executeSimulateStatus(effectiveSelectedStatus, description);
  }

  async function handlePrintLabel(shipmentId?: string) {
    const id = shipmentId ?? activeShipment?.id;
    if (!id || printLoading) return;
    setPrintLoading(true);
    setErrorMessage("");
    try {
      const label = await fulfillmentService.getPrintLabel(id, printPageSize);
      if (label.printUrl) {
        window.open(label.printUrl, "_blank", "noopener,noreferrer");
      } else {
        setErrorMessage("Không nhận được đường dẫn in phiếu giao hàng từ GHN.");
      }
    } catch (cause) {
      setErrorMessage(formatError(describeError(cause, { operation: "read" })));
    } finally {
      setPrintLoading(false);
    }
  }

  function selectShipmentFromTable(shipment: ShipmentDetail) {
    const code = getShipmentCodeKey(shipment);
    setInputCode(code);
    setActiveShipment(shipment);
    setMasterOrderShipments([]);
    setModalState(null);
    setErrorMessage("");
    setSuccessMessage(`Đã chọn vận đơn ${code}. Bạn có thể thao tác vòng đời GHN bên dưới.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleTableSearchSubmit(event: FormEvent) {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
    setPage(1);
  }

  function toggleStatusFilter(statusValue: string) {
    setSelectedStatuses((prev) =>
      prev.includes(statusValue) ? prev.filter((s) => s !== statusValue) : [...prev, statusValue],
    );
    setPage(1);
  }

  function clearTableFilters() {
    setSearchInput("");
    setAppliedSearch("");
    setSelectedStatuses([]);
    setSortOption("createdAt:desc");
    setPage(1);
  }

  const selectStatusOptions: readonly SelectBoxOption[] = useMemo(
    () =>
      GHN_SIMULATE_STATUS_OPTIONS.map((opt) => ({
        value: opt.value,
        label: opt.label,
        group: opt.group,
        disabled: activeShipment ? !isValidTransition(activeShipment.status, opt.targetEnum, force) : false,
      })),
    [activeShipment, force],
  );

  const sortSelectOptions: readonly SelectBoxOption[] = useMemo(
    () => SORT_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
    [],
  );

  const ctx = contextResource.data;
  const warehouseDetail = ctx?.warehouseDetail ?? null;
  const subOrderDetail = ctx?.subOrderDetail ?? null;
  const masterOrderDetail = ctx?.masterOrderDetail ?? null;
  const auctionOrderDetail = ctx?.auctionOrderDetail ?? null;
  const sellerAccount = ctx?.sellerAccount ?? null;
  const sellerPublic = ctx?.sellerPublic ?? null;
  const buyerAccount = ctx?.buyerAccount ?? null;
  const skuProductMap = ctx?.skuProductMap ?? {};

  const nextStep = activeShipment ? resolveNextStep(activeShipment.status) : null;
  const milestoneState = activeShipment ? resolveMilestoneState(activeShipment.status) : null;

  const resolvedSellerId = subOrderDetail?.sellerId ?? auctionOrderDetail?.sellerId ?? warehouseDetail?.sellerId ?? null;
  const resolvedBuyerId = subOrderDetail?.buyerId ?? auctionOrderDetail?.buyerId ?? activeShipment?.buyerId ?? null;
  const resolvedShopName =
    sellerAccount?.sellerProfile?.shopName ||
    sellerPublic?.shopName ||
    subOrderDetail?.shopName ||
    warehouseDetail?.name ||
    (resolvedSellerId ? `Shop ${resolvedSellerId.slice(0, 8)}` : "Đang cập nhật");

  const resolvedBuyerDisplayName =
    buyerAccount?.displayName ||
    `${buyerAccount?.firstName ?? ""} ${buyerAccount?.lastName ?? ""}`.trim() ||
    buyerAccount?.email ||
    activeShipment?.receiverName ||
    "—";

  const pagedData: PagedShipments | null = shipmentsResource.data ?? null;
  const hasActiveFilters = Boolean(appliedSearch || selectedStatuses.length > 0 || sortOption !== "createdAt:desc");

  return (
    <div className="page-stack admin-shipments-page">
      <PageHeading
        title="Quản lý Vận đơn & Giả lập Shipper (GHN)"
        description="Tra cứu vận đơn, mô phỏng vòng đời giao vận GHN Sandbox và kiểm tra đầy đủ Seller, Buyer, SubOrder, Order cha."
        action={
          <div className="admin-shipments-toolbar-actions">
            <a
              href="https://5sao.ghn.dev/ops-live"
              target="_blank"
              rel="noopener noreferrer"
              className="button button-secondary admin-shipments-toolbar-btn admin-shipments-btn-icon"
            >
              <Icon name="externalLink" size={15} />
              Cổng GHN 5 Sao
            </a>
            <a
              href="https://developer.ghn.dev/vi"
              target="_blank"
              rel="noopener noreferrer"
              className="button button-secondary admin-shipments-toolbar-btn admin-shipments-btn-icon"
            >
              <Icon name="externalLink" size={15} />
              Tài liệu API GHN
            </a>
          </div>
        }
      />

      {successMessage && (
        <p className="form-success" role="status">
          {successMessage}
        </p>
      )}
      {errorMessage && (
        <p className="notice" role="alert">
          {errorMessage}
        </p>
      )}

      {/* KHỐI 1: TRA CỨU & GIẢ LẬP VÒNG ĐỜI GHN */}
      <Card className="card-pad">
        <div className="admin-shipments-card-head">
          <h2>
            <Icon name="truck" size={20} />
            Giả lập hành trình Shipper (Sandbox Testing)
          </h2>
          <span className="admin-shipments-env-note">
            Môi trường GHN: <strong>dev-online-gateway.ghn.vn</strong>
          </span>
        </div>

        <form onSubmit={(e) => void handleSimulateSubmit(e)} className="admin-shipments-form-stack">
          <div className="admin-shipments-lookup-row">
            <label className="field-wrap">
              <span>Mã vận đơn GHN, mã đơn con (SubOrder) hoặc Order ID (*)</span>
              <input
                className="field"
                placeholder="Nhập mã vận đơn GHN (VD: LY9WHT), mã SubOrder (VD: SUB-... / AO-...) hoặc ID..."
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                required
              />
            </label>
            <button
              type="button"
              className="button button-secondary admin-shipments-form-btn admin-shipments-btn-icon"
              disabled={lookupLoading || !inputCode.trim()}
              onClick={() => void handleLookup()}
            >
              <Icon name="search" size={16} />
              {lookupLoading ? "Đang tra cứu…" : "Tra cứu"}
            </button>
          </div>

          {masterOrderShipments.length > 1 && (
            <div className="admin-shipments-master-picker">
              <span>Đơn hàng cha có {masterOrderShipments.length} đơn con, chọn để kiểm tra:</span>
              {masterOrderShipments.map((sub) => (
                <button
                  key={sub.subOrderId}
                  type="button"
                  className="button button-secondary button-small"
                  onClick={() => void handleLookup(sub.trackingCode ?? sub.subOrderId)}
                >
                  {sub.subOrderNo} ({sub.trackingCode ?? "Chưa có mã GHN"})
                </button>
              ))}
            </div>
          )}

          {/* GHN Lifecycle Stepper 5 mốc chính + Nút 1-click Chuyển bước kế tiếp */}
          {activeShipment && milestoneState && (
            <div className="ghn-stepper-box">
              <div className="ghn-stepper-head">
                <span className="ghn-stepper-title">
                  <Icon name="activity" size={16} />
                  Vòng đời GHN hiện tại:
                  <Badge tone={shipmentStatusTone(activeShipment.status)}>
                    {shipmentStatusLabel(activeShipment.status)}
                  </Badge>
                </span>
                <div className="ghn-stepper-next-wrap">
                  {nextStep && (
                    <button
                      type="button"
                      className="button button-primary button-small admin-shipments-btn-icon"
                      disabled={submitting}
                      onClick={() => void executeSimulateStatus(nextStep.value, nextStep.description)}
                    >
                      <Icon name="arrow" size={14} />
                      {submitting ? "Đang chuyển…" : `Chuyển bước kế tiếp: ${nextStep.label}`}
                    </button>
                  )}
                  {normalizeStatus(activeShipment.status) === "DELIVERYFAILED" && (
                    <button
                      type="button"
                      className="button button-secondary button-small admin-shipments-btn-icon"
                      disabled={submitting}
                      onClick={() =>
                        void executeSimulateStatus(
                          "delivery_fail",
                          "Khách không nghe máy — ghi nhận thêm lần giao thất bại",
                        )
                      }
                    >
                      <Icon name="alertTriangle" size={14} />
                      Ghi nhận thêm lần giao lỗi
                    </button>
                  )}
                </div>
              </div>

              <ol className="ghn-stepper-list">
                {LIFECYCLE_MILESTONES.map((step, index) => {
                  const isDone = !milestoneState.isException && index < milestoneState.activeIndex;
                  const isCurrent = !milestoneState.isException && index === milestoneState.activeIndex;
                  const isExStep = milestoneState.isException && index === milestoneState.activeIndex;
                  return (
                    <li
                      key={step.key}
                      className={`ghn-stepper-item${isDone ? " is-done" : ""}${isCurrent ? " is-current" : ""}${
                        isExStep ? " is-exception" : ""
                      }`}
                    >
                      <span className="ghn-stepper-dot">
                        <Icon name={isDone ? "check" : isExStep ? "alertTriangle" : step.icon} size={15} />
                      </span>
                      <span className="ghn-stepper-label">{step.label}</span>
                      <span className="ghn-stepper-sub">
                        {isCurrent
                          ? shipmentStatusLabel(activeShipment.status)
                          : step.subLabel}
                      </span>
                    </li>
                  );
                })}
              </ol>

              {milestoneState.isException && milestoneState.exceptionText && (
                <div className="ghn-stepper-exception-bar" role="status">
                  <div className="ghn-stepper-exception-copy">
                    <Icon name="rotateCcw" size={16} />
                    <span>{milestoneState.exceptionText}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chọn trạng thái GHN với SelectBox phân nhóm */}
          <div className="field-wrap">
            <span>Trạng thái muốn cập nhật (*)</span>
            <SelectBox
              ariaLabel="Trạng thái GHN muốn cập nhật"
              value={effectiveSelectedStatus}
              options={selectStatusOptions}
              onChange={setSelectedStatus}
              searchable={false}
            />
            <p className="admin-shipments-status-hint">
              {GHN_SIMULATE_STATUS_OPTIONS.find((opt) => opt.value === effectiveSelectedStatus)?.description}
              {activeShipment && !force && " · Các bước không hợp lệ với trạng thái hiện tại đã được tự động khóa."}
            </p>
          </div>

          <div className="admin-shipments-two-col">
            <label className="field-wrap">
              <span>Tên shipper thực hiện</span>
              <input
                className="field"
                value={shipperName}
                onChange={(e) => setShipperName(e.target.value)}
                placeholder="Nguyễn Văn Shipper"
              />
            </label>
            <label className="field-wrap">
              <span>Số điện thoại shipper</span>
              <input
                className="field"
                value={shipperPhone}
                onChange={(e) => setShipperPhone(e.target.value)}
                placeholder="0901234567"
              />
            </label>
          </div>

          <div className="admin-shipments-two-col">
            <label className="field-wrap">
              <span>Mô tả sự kiện hành trình</span>
              <input
                className="field"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ví dụ: Bưu tá đã lấy hàng thành công từ kho người bán"
              />
            </label>
            {["delivery_fail", "returning", "cancel"].includes(effectiveSelectedStatus) && (
              <label className="field-wrap">
                <span>Lý do thất bại / hoàn hàng</span>
                <input
                  className="field"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ví dụ: Khách hẹn giao lại ca chiều"
                />
              </label>
            )}
          </div>

          <label className="admin-shipments-force-toggle">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            <span>
              <strong>Bắt buộc chuyển trạng thái (Force override)</strong>: Mở khóa toàn bộ trạng thái để test nhảy cóc hoặc lùi bước.
            </span>
          </label>

          <div className="action-row">
            <button
              type="submit"
              className="button button-primary admin-shipments-form-btn admin-shipments-btn-icon"
              disabled={submitting || !inputCode.trim()}
            >
              <Icon name="truck" size={16} />
              {submitting ? "Đang cập nhật…" : "Cập nhật trạng thái Shipper"}
            </button>
          </div>
        </form>
      </Card>

      {/* KHỐI 2: CHI TIẾT VẬN ĐƠN + QUAN HỆ ORDER/SUBORDER + 2 BÊN SELLER/BUYER */}
      {activeShipment && (
        <Card className="card-pad">
          <div className="admin-shipments-card-head">
            <h3>
              <Icon name="package" size={18} />
              Chi tiết vận đơn: <span className="mono">{activeShipment.trackingNumber ?? activeShipment.id}</span>
            </h3>
            <div className="admin-shipment-detail-actions">
              <Badge tone={shipmentStatusTone(activeShipment.status)}>
                {shipmentStatusLabel(activeShipment.status)}
              </Badge>
              <div className="admin-shipment-print-select">
                <SelectBox
                  ariaLabel="Khổ giấy in phiếu GHN"
                  value={printPageSize}
                  options={PRINT_SIZE_OPTIONS}
                  onChange={(v) => setPrintPageSize(v as "A5" | "80x80" | "52x70")}
                  searchable={false}
                />
              </div>
              <button
                type="button"
                className="button button-secondary admin-shipments-toolbar-btn admin-shipments-btn-icon"
                disabled={printLoading}
                onClick={() => void handlePrintLabel()}
              >
                <Icon name="printer" size={14} />
                {printLoading ? "Đang lấy link in…" : "In phiếu GHN"}
              </button>
            </div>
          </div>

          {/* Thanh liên kết SubOrder (đơn con theo shop) <-> Order (đơn cha toàn bộ) */}
          <div className="admin-shipment-hierarchy-bar">
            <button
              type="button"
              className="admin-shipment-hierarchy-card"
              onClick={() => setModalState({ type: "suborder", targetId: activeShipment.orderId })}
            >
              <div className="admin-shipment-hierarchy-main">
                <span className="admin-shipment-hierarchy-eyebrow">
                  <Icon name="orders" size={13} />
                  {auctionOrderDetail ? "Đơn đấu giá (AuctionOrder)" : "Đơn con theo Shop (SubOrder)"}
                </span>
                <div className="admin-shipment-hierarchy-code">
                  <span className="mono">
                    {subOrderDetail?.subOrderNo ??
                      auctionOrderDetail?.orderNo ??
                      activeShipment.subOrderNo ??
                      activeShipment.orderId}
                  </span>
                  {subOrderDetail?.status && (
                    <Badge tone={semanticStatusTone(subOrderDetail.status)}>
                      {statusLabel(SUB_ORDER_STATUS, subOrderDetail.status)}
                    </Badge>
                  )}
                </div>
                <span className="admin-shipment-hierarchy-sub">
                  {subOrderDetail
                    ? `${subOrderDetail.shopName} · ${subOrderDetail.items.length} sản phẩm · Tổng ${formatMoney(subOrderDetail.totalAmount)}`
                    : auctionOrderDetail
                      ? `${auctionOrderDetail.productName} · Tổng ${formatMoney(auctionOrderDetail.totalAmount ?? auctionOrderDetail.winningAmount)}`
                      : contextResource.loading
                        ? "Đang tải chi tiết đơn con…"
                        : "Nhấn để xem sản phẩm, tiền hàng, voucher & tổng thanh toán"}
                </span>
              </div>
              <span className="admin-shipment-hierarchy-cta">
                Xem chi tiết
                <Icon name="chevron" size={14} />
              </span>
            </button>

            <button
              type="button"
              className="admin-shipment-hierarchy-card"
              disabled={!subOrderDetail?.orderId}
              onClick={() => {
                if (subOrderDetail?.orderId) {
                  setModalState({ type: "order", targetId: subOrderDetail.orderId });
                }
              }}
            >
              <div className="admin-shipment-hierarchy-main">
                <span className="admin-shipment-hierarchy-eyebrow">
                  <Icon name="layers" size={13} />
                  Đơn hàng cha (Master Order)
                </span>
                <div className="admin-shipment-hierarchy-code">
                  <span className="mono">
                    {masterOrderDetail?.orderNo ??
                      (subOrderDetail?.orderId
                        ? `ORD-${subOrderDetail.orderId.slice(0, 8).toUpperCase()}`
                        : auctionOrderDetail
                          ? "Không áp dụng (Đơn đấu giá)"
                          : "—")}
                  </span>
                  {masterOrderDetail?.status && (
                    <Badge tone={semanticStatusTone(masterOrderDetail.status)}>
                      {statusLabel(ORDER_STATUS, masterOrderDetail.status)}
                    </Badge>
                  )}
                </div>
                <span className="admin-shipment-hierarchy-sub">
                  {masterOrderDetail
                    ? `${masterOrderDetail.subOrders.length} shop/SubOrder · Tổng đơn cha ${formatMoney(masterOrderDetail.totalAmount)}`
                    : subOrderDetail?.orderId
                      ? "Nhấn để xem toàn bộ SubOrder con & voucher cấp đơn cha"
                      : auctionOrderDetail
                        ? "Đơn đấu giá không tách đơn cha nhiều shop"
                        : contextResource.loading
                          ? "Đang tra cứu đơn cha…"
                          : "Không có thông tin đơn cha"}
                </span>
              </div>
              {subOrderDetail?.orderId && (
                <span className="admin-shipment-hierarchy-cta">
                  Xem đơn cha
                  <Icon name="chevron" size={14} />
                </span>
              )}
            </button>
          </div>

          {/* 2 Thẻ tóm tắt 2 bên: Người giao (Seller) & Người nhận (Buyer) */}
          <div className="admin-shipment-parties-grid">
            <button
              type="button"
              className="admin-shipment-party-card"
              onClick={() => setModalState({ type: "seller", tab: "account" })}
            >
              <div className="admin-shipment-party-head">
                <span className="admin-shipment-party-role">
                  <Icon name="store" size={15} />
                  Người giao (Seller)
                </span>
                <span className="admin-shipment-hierarchy-cta">
                  Tài khoản & Kho
                  <Icon name="chevron" size={14} />
                </span>
              </div>
              <div className="admin-shipment-party-title">{resolvedShopName}</div>
              <div className="admin-shipment-party-meta">
                <span>
                  Kho lấy hàng: <strong>{warehouseDetail ? `${warehouseDetail.code} — ${warehouseDetail.name}` : activeShipment.warehouseId}</strong>
                </span>
                <span>
                  Liên hệ: <strong>{warehouseDetail?.contactPhone ?? sellerAccount?.phoneNumber ?? sellerPublic?.hotline ?? "—"}</strong>
                  {sellerAccount?.email ? ` · ${sellerAccount.email}` : ""}
                </span>
                <span>
                  Địa chỉ lấy: <strong>{warehouseDetail?.address ?? "Nhấn để xem địa chỉ & mã GHN kho"}</strong>
                </span>
              </div>
            </button>

            <button
              type="button"
              className="admin-shipment-party-card"
              onClick={() => setModalState({ type: "buyer" })}
            >
              <div className="admin-shipment-party-head">
                <span className="admin-shipment-party-role">
                  <Icon name="user" size={15} />
                  Người nhận (Buyer)
                </span>
                <span className="admin-shipment-hierarchy-cta">
                  Chi tiết người nhận
                  <Icon name="chevron" size={14} />
                </span>
              </div>
              <div className="admin-shipment-party-title">
                {activeShipment.receiverName} · <span className="tabular-nums">{activeShipment.receiverPhone}</span>
              </div>
              <div className="admin-shipment-party-meta">
                <span>
                  Tài khoản mua: <strong>{resolvedBuyerDisplayName}</strong>
                  {buyerAccount?.email ? ` · ${buyerAccount.email}` : ""}
                </span>
                <span>
                  Giao tới: <strong>{activeShipment.receiverAddress}</strong>
                </span>
                <span>
                  Khu vực GHN:{" "}
                  <strong className="tabular-nums">
                    {activeShipment.toProvinceName ?? "—"} (District {activeShipment.toDistrictId ?? "—"} · Ward {activeShipment.toWardCode ?? "—"})
                  </strong>
                </span>
              </div>
            </button>
          </div>

          {/* Thông số vận đơn */}
          <div className="admin-shipment-facts-grid">
            <div>
              <div className="info-row">
                <span>Mã vận đơn GHN</span>
                <strong className="mono">{activeShipment.trackingNumber ?? "—"}</strong>
              </div>
              <div className="info-row">
                <span>SubOrder ID</span>
                <CopyableId id={activeShipment.orderId} showFull />
              </div>
              <div className="info-row">
                <span>Phí vận chuyển / COD</span>
                <strong className="tabular-nums">
                  {formatMoney(activeShipment.shippingFee ?? 0)} / {formatMoney(activeShipment.codAmount ?? 0)}
                </strong>
              </div>
            </div>
            <div>
              <div className="info-row">
                <span>Ngày tạo vận đơn</span>
                <span className="tabular-nums">{formatDateTime(activeShipment.createdAt)}</span>
              </div>
              <div className="info-row">
                <span>Thời gian giao dự kiến</span>
                <span className="tabular-nums">{formatDateTime(activeShipment.estimatedDeliveryAt)}</span>
              </div>
              <div className="info-row">
                <span>Cập nhật gần nhất</span>
                <span className="tabular-nums">{formatDateTime(activeShipment.updatedAt ?? getLatestEventTime(activeShipment))}</span>
              </div>
            </div>
          </div>

          {activeShipment.items && activeShipment.items.length > 0 && (
            <div className="admin-shipment-section-sub">
              <h4>Sản phẩm trong đơn ship ({activeShipment.items.length})</h4>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th>SKU ID</th>
                      <th className="text-right">Số lượng</th>
                      <th className="text-right">Đơn giá</th>
                      <th className="text-right">Khối lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeShipment.items.map((item, idx) => {
                      const productId = skuProductMap[item.skuId];
                      return (
                        <tr key={`${item.skuId}-${idx}`}>
                          <td>
                            {productId ? (
                              <Link
                                href={ROUTES.catalog.product(productId)}
                                className="admin-shipment-product-link"
                                onClick={() => syncUrlState(activeShipment, modalState)}
                              >
                                <TruncatedText text={item.name} label="Tên sản phẩm" maxWidth={260} />
                                <Icon name="externalLink" size={13} />
                              </Link>
                            ) : (
                              <strong>
                                <TruncatedText text={item.name} label="Tên sản phẩm" maxWidth={260} />
                              </strong>
                            )}
                          </td>
                          <td>
                            <CopyableId id={item.skuId} />
                          </td>
                          <td className="text-right tabular-nums">{item.quantity}</td>
                          <td className="text-right tabular-nums">{formatMoney(item.price)}</td>
                          <td className="text-right tabular-nums">{item.weight ? `${item.weight}g` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeShipment.events && activeShipment.events.length > 0 && (
            <div className="admin-shipment-section-sub">
              <h4>Hành trình bưu tá ghi nhận</h4>
              <ShipmentTimelineList
                events={activeShipment.events.map((e) => ({
                  status: e.status,
                  title: shipmentStatusLabel(e.status),
                  description: e.description ?? e.reason ?? "Cập nhật trạng thái",
                  occurredAt: e.occurredAt,
                  location: e.warehouseName ?? null,
                }))}
              />
            </div>
          )}
        </Card>
      )}

      {/* KHỐI 3: DANH SÁCH VẬN ĐƠN TOÀN SÀN (FLUSH TABLE CARD) */}
      <Card>
        <div className="admin-shipments-list-head">
          <div className="admin-shipments-list-top">
            <h2>Danh sách vận đơn toàn sàn</h2>
            <div className="admin-shipments-sort-wrap">
              <span className="admin-shipments-sort-label">Sắp xếp:</span>
              <div className="admin-shipments-sort-select">
                <SelectBox
                  ariaLabel="Sắp xếp vận đơn theo thời gian"
                  value={sortOption}
                  options={sortSelectOptions}
                  onChange={(v) => {
                    setSortOption(v as SortOptionValue);
                    setPage(1);
                  }}
                  searchable={false}
                />
              </div>
              <button
                type="button"
                className="button button-secondary admin-shipments-toolbar-btn admin-shipments-btn-icon"
                onClick={() => setRefreshTrigger((v) => v + 1)}
              >
                <Icon name="refreshCw" size={14} />
                Làm mới
              </button>
            </div>
          </div>

          <form onSubmit={handleTableSearchSubmit} className="admin-shipments-search-form">
            <div className="admin-shipments-search-input-wrap">
              <input
                type="search"
                aria-label="Tìm kiếm đơn vận chuyển"
                className="field admin-shipments-search-input"
                placeholder="Tìm theo mã vận đơn GHN, mã SubOrder (SUB-... / AO-...), tên hoặc SĐT người nhận..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="button button-primary admin-shipments-form-btn admin-shipments-btn-icon"
            >
              <Icon name="search" size={15} />
              Tìm kiếm
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                className="button button-secondary admin-shipments-form-btn"
                onClick={clearTableFilters}
              >
                Xóa lọc
              </button>
            )}
          </form>

          <div className="admin-shipments-chips" role="group" aria-label="Lọc theo trạng thái vận đơn">
            <span className="admin-shipments-chips-label">Trạng thái:</span>
            <button
              type="button"
              aria-pressed={selectedStatuses.length === 0}
              className={`admin-shipments-chip${selectedStatuses.length === 0 ? " is-active" : ""}`}
              onClick={() => {
                setSelectedStatuses([]);
                setPage(1);
              }}
            >
              Tất cả
            </button>
            {SHIPMENT_FILTER_STATUS_OPTIONS.map((opt) => {
              const active = selectedStatuses.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  className={`admin-shipments-chip${active ? " is-active" : ""}`}
                  onClick={() => toggleStatusFilter(opt.value)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {shipmentsResource.loading && !pagedData ? (
          <div className="admin-shipments-table-state">
            <NoData title="Đang tải danh sách vận đơn…" />
          </div>
        ) : shipmentsResource.error ? (
          <div className="admin-shipments-table-state">
            <p className="notice" role="alert">
              {formatError(describeError(shipmentsResource.error, { operation: "read" }))}
            </p>
          </div>
        ) : !pagedData?.items.length ? (
          <div className="admin-shipments-table-state">
            <NoData
              title={
                hasActiveFilters
                  ? "Không tìm thấy vận đơn nào khớp bộ lọc hiện tại."
                  : "Chưa có vận đơn nào được tạo. Các đơn hàng được người bán tiếp nhận sẽ xuất hiện tại đây."
              }
            />
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã vận đơn GHN</th>
                    <th>Đơn hàng (SubOrder)</th>
                    <th>Sản phẩm</th>
                    <th>Người nhận</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                    <th className="sticky-col-right text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedData.items.map((s) => {
                    const isSelected = activeShipment?.id === s.id;
                    const createdLabel = formatDateTime(s.createdAt);
                    const updatedLabel = formatDateTime(s.updatedAt ?? getLatestEventTime(s));
                    const itemsPreview = s.items?.length
                      ? s.items
                          .slice(0, 2)
                          .map((i) => `${i.name} ×${i.quantity}`)
                          .join(", ") + (s.items.length > 2 ? ` (+${s.items.length - 2})` : "")
                      : "—";
                    return (
                      <tr key={s.id} className={isSelected ? "admin-shipments-row-selected" : undefined}>
                        <td>
                          <strong className="mono">{s.trackingNumber ?? "—"}</strong>
                          <div className="admin-shipments-cell-sub">
                            <CopyableId id={s.carrierId} />
                          </div>
                        </td>
                        <td>
                          {s.subOrderNo && <div className="mono"><strong>{s.subOrderNo}</strong></div>}
                          <CopyableId id={s.orderId} />
                        </td>
                        <td>
                          <TruncatedText text={itemsPreview} label="Sản phẩm" maxWidth={220} />
                        </td>
                        <td>
                          <div>
                            <strong>{s.receiverName}</strong> · <span className="tabular-nums">{s.receiverPhone}</span>
                          </div>
                          <div className="admin-shipments-cell-sub">
                            <TruncatedText text={s.receiverAddress} label="Địa chỉ nhận" maxWidth={260} />
                          </div>
                        </td>
                        <td>
                          <Badge tone={shipmentStatusTone(s.status)}>{shipmentStatusLabel(s.status)}</Badge>
                        </td>
                        <td className="admin-shipments-time-cell tabular-nums">
                          <div>Tạo: {createdLabel}</div>
                          <div className="admin-shipments-cell-sub">Cập nhật: {updatedLabel}</div>
                        </td>
                        <td className="sticky-col-right text-right">
                          <button
                            type="button"
                            className="button button-secondary button-small admin-shipments-btn-icon"
                            onClick={() => selectShipmentFromTable(s)}
                          >
                            <Icon name="truck" size={13} />
                            Chọn đơn này
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pagedData.pagination.totalPages > 1 && (
              <div className="admin-shipments-pagination-wrap">
                <AdminPagination
                  page={page}
                  pageSize={pagedData.pagination.pageSize}
                  totalItems={pagedData.pagination.totalCount}
                  totalPages={pagedData.pagination.totalPages}
                  loading={shipmentsResource.loading}
                  onPageChange={setPage}
                  itemLabel="vận đơn"
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* POPUPS CHI TIẾT */}
      <SellerDetailModal
        key={`seller-${resolvedSellerId ?? ""}-${activeShipment?.warehouseId ?? ""}-${modalState?.type === "seller" ? modalState.tab : "closed"}`}
        open={modalState?.type === "seller"}
        sellerId={resolvedSellerId}
        warehouseId={activeShipment?.warehouseId ?? null}
        initialTab={modalState?.type === "seller" ? modalState.tab : "account"}
        warehouseData={warehouseDetail}
        sellerAccountData={sellerAccount}
        sellerPublicData={sellerPublic}
        loading={contextResource.loading}
        onClose={() => setModalState(null)}
      />

      <BuyerDetailModal
        open={modalState?.type === "buyer"}
        buyerId={resolvedBuyerId}
        shipment={activeShipment}
        buyerAccountData={buyerAccount}
        loading={contextResource.loading}
        onClose={() => setModalState(null)}
      />

      <OrderSubOrderDetailModal
        open={modalState?.type === "suborder" || modalState?.type === "order"}
        mode={modalState?.type === "order" ? "order" : "suborder"}
        targetId={
          modalState?.type === "suborder" || modalState?.type === "order"
            ? modalState.targetId
            : null
        }
        activeSubOrderId={activeShipment?.orderId ?? null}
        initialSubOrder={subOrderDetail}
        initialOrder={masterOrderDetail}
        initialAuctionOrder={auctionOrderDetail}
        onSwitchTarget={(nextMode, nextTargetId) =>
          setModalState({ type: nextMode, targetId: nextTargetId })
        }
        onBeforeNavigateProduct={() => syncUrlState(activeShipment, modalState)}
        onClose={() => setModalState(null)}
      />
    </div>
  );
}
