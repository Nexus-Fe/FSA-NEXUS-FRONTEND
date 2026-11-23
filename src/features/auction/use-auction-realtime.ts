"use client";

import { useEffect, useRef, useState } from "react";
import { AuctionHubClient, type HubStatus } from "@/lib/realtime/hub-client";
import { asBidPlaced, type BidPlacedEvent } from "./realtime-rules";

let configPromise: Promise<string | null> | null = null;

/** The hub address from `/api/realtime`, asked once per page load. A failure means "no realtime", never an error. */
function loadHubUrl(): Promise<string | null> {
  configPromise ??= fetch("/api/realtime", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : { url: null }))
    .then((body: { url?: unknown }) => (typeof body.url === "string" && body.url ? body.url : null))
    .catch(() => null);
  return configPromise;
}

type Handlers = { onBid?: (event: BidPlacedEvent) => void; onStatusChanged?: () => void; onCancelled?: () => void };

/**
 * Joins one auction on the hub while the room is open and reports whether the live connection is up. The handlers are read through a ref so a
 * re-render never reconnects.
 */
export function useAuctionRealtime(auctionId: string | null, handlers: Handlers): HubStatus {
  const [status, setStatus] = useState<HubStatus>("idle");
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (!auctionId) return;
    let cancelled = false;
    let client: AuctionHubClient | null = null;
    const offs: Array<() => void> = [];
    void loadHubUrl().then((url) => {
      if (cancelled || !url) return;
      client = new AuctionHubClient(url);
      offs.push(client.onStatus(setStatus));
      offs.push(client.on("BidPlaced", (payload) => { const event = asBidPlaced(payload); if (event) latest.current.onBid?.(event); }));
      offs.push(client.on("AuctionStatusChanged", () => latest.current.onStatusChanged?.()));
      offs.push(client.on("AuctionCancelled", () => latest.current.onCancelled?.()));
      void client.start().then(() => client?.join(auctionId));
      // The join is also repeated by the client after every reconnect.
    });
    return () => {
      cancelled = true;
      for (const off of offs) off();
      if (client) { client.leave(auctionId); client.stop(); }
      setStatus("idle");
    };
  }, [auctionId]);

  return status;
}
