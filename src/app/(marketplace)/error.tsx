"use client";

import { RouteError } from "@/components/ui/RouteStates";

export default function SegmentError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} homeHref="/" />;
}
