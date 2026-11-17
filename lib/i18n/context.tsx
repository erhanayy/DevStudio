"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { tr } from "./dictionaries/tr";
import { en } from "./dictionaries/en";

type Locale = "tr" | "en";
type Dictionary = typeof tr;

interface TranslationContextType {
  locale: Locale;
  setLanguage: (lang: Locale) => void;
  t: (key: string) => string;
}

const dictionaries: Record<Locale, Dictionary> = { tr, en };

const TranslationContext = createContext<TranslationContextType>({
  locale: "tr",
  setLanguage: () => {},
  t: (key: string) => key,
});

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("tr");

  useEffect(() => {
    const saved = localStorage.getItem("devstudio_locale") as Locale;
    if (saved && (saved === "tr" || saved === "en")) {
      setLocale(saved);
    }
  }, []);

  const setLanguage = (lang: Locale) => {
    setLocale(lang);
    localStorage.setItem("devstudio_locale", lang);
  };

  const t = (path: string): string => {
    const keys = path.split(".");
    let current: any = dictionaries[locale];

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return path;
      }
    }

    return typeof current === "string" ? current : path;
  };

  return (
    <TranslationContext.Provider value={{ locale, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  return useContext(TranslationContext);
}
