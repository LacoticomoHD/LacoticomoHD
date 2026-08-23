import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { Shop, ShopFeature } from '@/types';

import { isOpenNow } from './openingHours';

/** Gemeinsamer Filter für Karte und Liste: Besonderheiten (UND-verknüpft) +
 *  "Jetzt geöffnet" + "Kartenzahlung möglich". */
interface FilterContextValue {
  activeFeatures: ShopFeature[];
  openNowOnly: boolean;
  cardPaymentOnly: boolean;
  menuOnly: boolean;
  toggleFeature: (f: ShopFeature) => void;
  toggleOpenNow: () => void;
  toggleCardPayment: () => void;
  toggleMenu: () => void;
  hasActiveFilters: boolean;
  matchesFilters: (shop: Shop) => boolean;
}

const FilterContext = createContext<FilterContextValue>({
  activeFeatures: [],
  openNowOnly: false,
  cardPaymentOnly: false,
  menuOnly: false,
  toggleFeature: () => {},
  toggleOpenNow: () => {},
  toggleCardPayment: () => {},
  toggleMenu: () => {},
  hasActiveFilters: false,
  matchesFilters: () => true,
});

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [activeFeatures, setActiveFeatures] = useState<ShopFeature[]>([]);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [cardPaymentOnly, setCardPaymentOnly] = useState(false);
  const [menuOnly, setMenuOnly] = useState(false);

  const toggleFeature = useCallback((f: ShopFeature) => {
    setActiveFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  }, []);

  const toggleOpenNow = useCallback(() => setOpenNowOnly((prev) => !prev), []);
  const toggleCardPayment = useCallback(() => setCardPaymentOnly((prev) => !prev), []);
  const toggleMenu = useCallback(() => setMenuOnly((prev) => !prev), []);

  const matchesFilters = useCallback(
    (shop: Shop) => {
      if (openNowOnly && !isOpenNow(shop.opening_hours ?? {})) return false;
      if (cardPaymentOnly && shop.kartenzahlung !== true) return false;
      if (menuOnly && shop.menue_preis == null) return false;
      return activeFeatures.every((f) => (shop.features ?? []).includes(f));
    },
    [activeFeatures, openNowOnly, cardPaymentOnly, menuOnly]
  );

  const value = useMemo(
    () => ({
      activeFeatures,
      openNowOnly,
      cardPaymentOnly,
      menuOnly,
      toggleFeature,
      toggleOpenNow,
      toggleCardPayment,
      toggleMenu,
      hasActiveFilters:
        openNowOnly || cardPaymentOnly || menuOnly || activeFeatures.length > 0,
      matchesFilters,
    }),
    [
      activeFeatures,
      openNowOnly,
      cardPaymentOnly,
      menuOnly,
      toggleFeature,
      toggleOpenNow,
      toggleCardPayment,
      toggleMenu,
      matchesFilters,
    ]
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters() {
  return useContext(FilterContext);
}
