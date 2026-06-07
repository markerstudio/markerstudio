"use client";

import { useEffect, useState } from "react";
import { MARKER_CONTENT, type Lang } from "@/lib/content";

const KEY = "marker-lang";

// Shared language state: persists in localStorage and keeps the document's
// dir/lang/body-class in sync, so EN/AR is consistent across every route
// (home, project pages) without a global provider.
export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "en" || saved === "ar") setLangState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const t = MARKER_CONTENT[lang];
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
    document.body.className = t.bodyClass;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  };

  return [lang, setLang];
}
