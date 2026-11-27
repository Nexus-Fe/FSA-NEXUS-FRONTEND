"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { parseFeatureList, type FeatureKey } from "./feature-flags";

type FeatureState = { loaded: boolean; enabled: ReadonlySet<FeatureKey> };

export const FeatureContext = createContext<FeatureState>({ loaded: false, enabled: new Set() });

let cached: FeatureKey[] | null = null;

/**
 * Loads `/api/features` once per page load. Until it answers, and when it fails, every flag is off: a screen behind a flag
 * stays hidden rather than appearing and then disappearing.
 */
export function FeatureProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FeatureState>(() =>
    cached ? { loaded: true, enabled: new Set(cached) } : { loaded: false, enabled: new Set() },
  );

  useEffect(() => {
    if (cached) return;
    const controller = new AbortController();
    fetch("/api/features", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { enabled: [] }))
      .catch(() => ({ enabled: [] }))
      .then((body: { enabled?: unknown }) => {
        if (controller.signal.aborted) return;
        cached = parseFeatureList(Array.isArray(body.enabled) ? body.enabled.join(",") : "");
        setState({ loaded: true, enabled: new Set(cached) });
      });
    return () => controller.abort();
  }, []);

  return <FeatureContext.Provider value={state}>{children}</FeatureContext.Provider>;
}

export function useFeature(key: FeatureKey): boolean {
  return useContext(FeatureContext).enabled.has(key);
}

export function useFeaturesLoaded(): boolean {
  return useContext(FeatureContext).loaded;
}

/** Shown on the page of a screen whose flag is off (someone typed the address by hand). */
export function FeatureUnavailable() {
  const loaded = useFeaturesLoaded();
  if (!loaded) {
    return (
      <main className="page-stack">
        <p role="status">Đang kiểm tra chức năng…</p>
      </main>
    );
  }
  return (
    <main className="page-stack">
      <section className="card card-pad" role="status">
        <h1>Chức năng chưa được bật ở môi trường này</h1>
        <p>Vui lòng quay lại sau khi hệ thống hoàn tất kết nối.</p>
      </section>
    </main>
  );
}
