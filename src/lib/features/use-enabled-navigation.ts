"use client";

import { useContext } from "react";
import type { NavigationItem, NavigationSection } from "@/constants/navigation";
import { filterByFeature, filterSectionsByFeature } from "./feature-flags";
import { FeatureContext } from "./FeatureProvider";

export function useEnabledNavigation(items: NavigationItem[]): NavigationItem[] {
  const { enabled } = useContext(FeatureContext);
  return filterByFeature(items, enabled);
}

export function useEnabledNavigationSections(sections: NavigationSection[]): NavigationSection[] {
  const { enabled } = useContext(FeatureContext);
  return filterSectionsByFeature(sections, enabled);
}
