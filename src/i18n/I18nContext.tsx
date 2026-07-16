import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { NativeModules, Platform } from 'react-native';

import {
  CATEGORY_I18N,
  FEATURE_I18N,
  Language,
  LANGUAGES,
  REPORT_REASON_I18N,
  translations,
  WEEKDAY_I18N,
} from './translations';

const STORAGE_KEY = 'dondoener.language';

/** Ermittelt die Startsprache aus der Geräteeinstellung (de/en/tr), sonst Deutsch. */
function detectDeviceLanguage(): Language {
  try {
    let locale = 'de';
    if (Platform.OS === 'ios') {
      locale =
        NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
        'de';
    } else if (Platform.OS === 'android') {
      locale = NativeModules.I18nManager?.localeIdentifier || 'de';
    } else if (typeof navigator !== 'undefined') {
      locale = navigator.language || 'de';
    }
    const code = locale.slice(0, 2).toLowerCase() as Language;
    return LANGUAGES.includes(code) ? code : 'de';
  } catch {
    return 'de';
  }
}

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  featureLabel: (feature: string) => string;
  categoryLabel: (category: string) => string;
  weekdayLabel: (day: string) => string;
  reportReasonLabel: (reason: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('de');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && (LANGUAGES as readonly string[]).includes(stored)) {
        setLangState(stored as Language);
      } else {
        setLangState(detectDeviceLanguage());
      }
    });
  }, []);

  const setLang = (next: Language) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string, vars?: Record<string, string | number>) => {
      let text = translations[lang][key] ?? translations.de[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return text;
    };
    return {
      lang,
      setLang,
      t,
      featureLabel: (f) => FEATURE_I18N[f]?.[lang] ?? f,
      categoryLabel: (c) => CATEGORY_I18N[c]?.[lang] ?? c,
      weekdayLabel: (d) => WEEKDAY_I18N[d]?.[lang] ?? d,
      reportReasonLabel: (r) => REPORT_REASON_I18N[r]?.[lang] ?? r,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
