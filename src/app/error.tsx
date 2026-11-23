"use client";

import { RouteError } from "@/components/ui/RouteStates";

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} />;
}
