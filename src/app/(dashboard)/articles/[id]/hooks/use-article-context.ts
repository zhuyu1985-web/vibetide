"use client";

import { useState, useCallback } from "react";
import type { AppearanceSettings } from "../types";

const STORAGE_KEY = "article-appearance";

const DEFAULT_APPEARANCE: AppearanceSettings = {
  fontSize: 16,
  lineHeight: "comfortable",
  margins: "standard",
  theme: "system",
  fontFamily: "system",
};

export function useAppearance() {
  const [appearance, setAppearanceState] = useState<AppearanceSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_APPEARANCE;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_APPEARANCE, ...JSON.parse(stored) } : DEFAULT_APPEARANCE;
    } catch {
      return DEFAULT_APPEARANCE;
    }
  });

  const setAppearance = useCallback(
    (updates: Partial<AppearanceSettings>) => {
      setAppearanceState((prev) => {
        const next = { ...prev, ...updates };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* storage full or unavailable */
        }
        return next;
      });
    },
    []
  );

  return { appearance, setAppearance };
}
