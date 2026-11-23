"use client";

import { useContext } from "react";
import type { NavigationItem } from "@/constants/navigation";
import { filterByFeature } from "./feature-flags";
import { FeatureContext } from "./FeatureProvider";

export function useEnabledNavigation(items: NavigationItem[]): NavigationItem[] {
  const { enabled } = useContext(FeatureContext);
  return filterByFeature(items, enabled);
}
