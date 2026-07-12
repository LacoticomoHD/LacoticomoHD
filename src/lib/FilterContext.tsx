import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { Shop, ShopFeature } from '@/types';

import { isOpenNow } from './openingHours';

/** Gemeinsamer Filter für Karte und Liste: Besonderheiten (UND-verknüpft) + "Jetzt geöffnet". */
interface FilterContextValue {
  activeFeatures: ShopFeature[];
  openNowOnly: boolean;
  toggleFeature: (f: ShopFeature) => void;
  toggleOpenNow: () => void;
  hasActiveFilters: boolean;
  matchesFilters: (shop: Shop) => boolean;
}

const FilterContext = createContext<FilterContextValue>({
  activeFeatures: [],
  openNowOnly: false,
  toggleFeature: () => {},
  toggleOpenNow: () => {},
  hasActiveFilters: false,
  matchesFilters: () => true,
});

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [activeFeatures, setActiveFeatures] = useState<ShopFeature[]>([]);
  const [openNowOnly, setOpenNowOnly] = useState(false);

  const toggleFeature = useCallback((f: ShopFeature) => {
    setActiveFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  }, []);

  const toggleOpenNow = useCallback(() => setOpenNowOnly((prev) => !prev), []);

  const matchesFilters = useCallback(
    (shop: Shop) => {
      if (openNowOnly && !isOpenNow(shop.opening_hours ?? {})) return false;
      return activeFeatures.every((f) => (shop.features ?? []).includes(f));
    },
    [activeFeatures, openNowOnly]
  );

  const value = useMemo(
    () => ({
      activeFeatures,
      openNowOnly,
      toggleFeature,
      toggleOpenNow,
      hasActiveFilters: openNowOnly || activeFeatures.length > 0,
      matchesFilters,
    }),
    [activeFeatures, openNowOnly, toggleFeature, toggleOpenNow, matchesFilters]
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters() {
  return useContext(FilterContext);
}
