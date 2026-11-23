"use client";

import { useSession } from "@/components/auth/SessionProvider";
import { useApiResource } from "@/lib/api/use-api-resource";
import { sellerCatalogService } from "./services/catalog.service";
import { warehouseReadiness, type WarehouseReadiness } from "./warehouse-readiness";

/** The seller's own warehouse and whether it can ship. `readiness` is null until the answer is known. */
export function useWarehouseReadiness(): { readiness: WarehouseReadiness | null; reload: () => void } {
  const { user } = useSession();
  const resource = useApiResource(
    user?.id ? `seller-warehouse-readiness:${user.id}` : null,
    (signal) => sellerCatalogService.listWarehouses(user?.id, signal),
  );
  return { readiness: resource.data ? warehouseReadiness(resource.data[0] ?? null) : null, reload: resource.reload };
}
