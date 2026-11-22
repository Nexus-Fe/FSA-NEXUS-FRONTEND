"use client";

import { useState } from "react";
import { useApiResource } from "@/lib/api/use-api-resource";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { auctionService } from "./services/auction.service";

/** The server has no call that says whether one auction is watched, so the buyer's watchlist is searched (a few pages are enough to tell). */
async function findWatch(auctionId: string, signal: AbortSignal): Promise<{ isWatching: boolean; notifyOnNewBid: boolean }> {
  for (let page = 1; page <= 5; page += 1) {
    const result = await auctionService.myWatchlist(page, signal);
    const found = result.items.find((item) => item.auctionId.toLowerCase() === auctionId.toLowerCase());
    if (found) return { isWatching: true, notifyOnNewBid: found.notifyOnNewBid };
    if (!result.pagination.hasNextPage) break;
  }
  return { isWatching: false, notifyOnNewBid: true };
}

export function AuctionWatchButton({ auctionId, userId }: { auctionId: string; userId: string }) {
  const known = useApiResource(`auction-watch-state:${userId}:${auctionId}`, (signal) => findWatch(auctionId, signal));
  const [override, setOverride] = useState<{ isWatching: boolean; notifyOnNewBid: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const state = override ?? known.data;

  async function toggle() {
    if (busy || !state) return;
    setBusy(true); setError("");
    try {
      setOverride(state.isWatching ? await auctionService.unwatch(auctionId) : await auctionService.watch(auctionId, true));
    } catch (cause) {
      setError(formatError(describeError(cause, { operation: "write" })));
    } finally {
      setBusy(false);
    }
  }

  return <div className="auction-watch">
    <button type="button" className="button button-secondary button-small" disabled={busy || !state} onClick={() => void toggle()} aria-pressed={state?.isWatching ?? false}>
      {!state ? "Đang tải…" : state.isWatching ? "Bỏ theo dõi" : "Theo dõi phiên"}
    </button>
    {error && <small className="auction-field-error" role="alert"> {error}</small>}
  </div>;
}
