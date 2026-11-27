"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ResourceState<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
};

type StoredState<T> = {
  key: string | null;
  revision: number;
  data: T | null;
  error: Error | null;
};

const CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 100;
const resourceCache = new Map<string, { data: unknown; storedAt: number }>();

function readCachedResource<T>(key: string | null): T | null {
  if (!key) return null;
  const entry = resourceCache.get(key);
  if (!entry || Date.now() - entry.storedAt > CACHE_TTL_MS) {
    return null;
  }
  return entry.data as T;
}

function writeCachedResource<T>(key: string, data: T): void {
  if (resourceCache.has(key)) {
    resourceCache.delete(key);
  } else if (resourceCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = resourceCache.keys().next().value;
    if (oldestKey !== undefined) resourceCache.delete(oldestKey);
  }
  resourceCache.set(key, { data, storedAt: Date.now() });
}

export function clearApiResourceCache(key?: string): void {
  if (key) {
    resourceCache.delete(key);
  } else {
    resourceCache.clear();
  }
}

export function startResourceLoad<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  onSuccess: (data: T) => void,
  onError: (error: unknown) => void,
): void {
  if (signal.aborted) return;
  const deliverSuccess = (data: T) => { if (!signal.aborted) onSuccess(data); };
  const deliverError = (error: unknown) => { if (!signal.aborted) onError(error); };
  try {
    loader(signal).then(deliverSuccess, deliverError);
  } catch (error) {
    deliverError(error);
  }
}

export function useApiResource<T>(
  key: string | null,
  loader: (signal: AbortSignal) => Promise<T>,
): ResourceState<T> {
  const loaderRef = useRef(loader);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<StoredState<T>>({
    key: null,
    revision: -1,
    data: null,
    error: null,
  });

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const currentRevision = revision;
    const onSuccess = (data: T) => {
      writeCachedResource(key, data);
      setState({ key, revision: currentRevision, data, error: null });
    };
    const onError = (error: unknown) => {
      resourceCache.delete(key);
      setState({
        key,
        revision: currentRevision,
        data: null,
        error: error instanceof Error ? error : new Error("Không tải được dữ liệu."),
      });
    };
    startResourceLoad(loaderRef.current, controller.signal, onSuccess, onError);
    return () => controller.abort();
  }, [key, revision]);

  const reload = useCallback(() => {
    if (key) resourceCache.delete(key);
    setRevision((current) => current + 1);
  }, [key]);
  const matchingKey = Boolean(key) && state.key === key;
  const current = matchingKey && state.revision === revision;
  const cachedData = !matchingKey ? readCachedResource<T>(key) : null;
  return {
    data: matchingKey ? state.data : cachedData,
    error: current ? state.error : null,
    loading: Boolean(key) && !current && cachedData === null,
    reload,
  };
}
