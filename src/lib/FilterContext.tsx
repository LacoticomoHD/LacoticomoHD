import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Shop, ShopFeature } from '@/types';

import { isOpenNow } from './openingHours';

/** Sortierung der Liste „Alle Läden" – wird mit den Filtern gespeichert. */
export type SortMode = 'rating' | 'distance' | 'price';

const STORAGE_KEY = 'dd.filters.v1';

interface StoredFilters {
  activeFeatures: ShopFeature[];
  openNowOnly: boolean;
  cardPaymentOnly: boolean;
  menuOnly: boolean;
  sortMode: SortMode;
}

/** Gemeinsamer Filter für Karte und Liste: Besonderheiten (UND-verknüpft) +
 *  "Jetzt geöffnet" + "Kartenzahlung möglich". Bleibt über App-Starts erhalten. */
interface FilterContextValue {
  activeFeatures: ShopFeature[];
  openNowOnly: boolean;
  cardPaymentOnly: boolean;
  menuOnly: boolean;
  sortMode: SortMode;
  toggleFeature: (f: ShopFeature) => void;
  toggleOpenNow: () => void;
  toggleCardPayment: () => void;
  toggleMenu: () => void;
  setSortMode: (m: SortMode) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
  matchesFilters: (shop: Shop) => boolean;
}

const FilterContext = createContext<FilterContextValue>({
  activeFeatures: [],
  openNowOnly: false,
  cardPaymentOnly: false,
  menuOnly: false,
  sortMode: 'rating',
  toggleFeature: () => {},
  toggleOpenNow: () => {},
  toggleCardPayment: () => {},
  toggleMenu: () => {},
  setSortMode: () => {},
  resetFilters: () => {},
  hasActiveFilters: false,
  matchesFilters: () => true,
});

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [activeFeatures, setActiveFeatures] = useState<ShopFeature[]>([]);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [cardPaymentOnly, setCardPaymentOnly] = useState(false);
  const [menuOnly, setMenuOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('rating');
  // Erst nach dem Laden speichern – sonst überschreibt der Startzustand die Auswahl.
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const s = JSON.parse(raw) as Partial<StoredFilters>;
        if (Array.isArray(s.activeFeatures)) setActiveFeatures(s.activeFeatures);
        setOpenNowOnly(!!s.openNowOnly);
        setCardPaymentOnly(!!s.cardPaymentOnly);
        setMenuOnly(!!s.menuOnly);
        if (s.sortMode === 'rating' || s.sortMode === 'price' || s.sortMode === 'distance') {
          setSortMode(s.sortMode);
        }
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const s: StoredFilters = { activeFeatures, openNowOnly, cardPaymentOnly, menuOnly, sortMode };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s)).catch(() => {});
  }, [activeFeatures, openNowOnly, cardPaymentOnly, menuOnly, sortMode]);

  const toggleFeature = useCallback((f: ShopFeature) => {
    setActiveFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  }, []);

  const toggleOpenNow = useCallback(() => setOpenNowOnly((prev) => !prev), []);
  const toggleCardPayment = useCallback(() => setCardPaymentOnly((prev) => !prev), []);
  const toggleMenu = useCallback(() => setMenuOnly((prev) => !prev), []);
  const resetFilters = useCallback(() => {
    setActiveFeatures([]);
    setOpenNowOnly(false);
    setCardPaymentOnly(false);
    setMenuOnly(false);
  }, []);

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
      sortMode,
      toggleFeature,
      toggleOpenNow,
      toggleCardPayment,
      toggleMenu,
      setSortMode,
      resetFilters,
      hasActiveFilters:
        openNowOnly || cardPaymentOnly || menuOnly || activeFeatures.length > 0,
      matchesFilters,
    }),
    [
      activeFeatures,
      openNowOnly,
      cardPaymentOnly,
      menuOnly,
      sortMode,
      toggleFeature,
      toggleOpenNow,
      toggleCardPayment,
      toggleMenu,
      resetFilters,
      matchesFilters,
    ]
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters() {
  return useContext(FilterContext);
}
