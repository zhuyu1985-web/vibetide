"use client";
import { useMemo } from "react";

export interface OutlineItem {
  id: string;
  text: string;
  level: number;
  position: number;
}

export function useOutline(htmlContent: string): OutlineItem[] {
  return useMemo(() => {
    if (!htmlContent || typeof window === "undefined") return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const headings = doc.querySelectorAll("h1, h2, h3");
    return Array.from(headings).map((h, i) => ({
      id: `heading-${i}`,
      text: h.textContent?.trim() ?? "",
      level: parseInt(h.tagName[1]),
      position: i,
    }));
  }, [htmlContent]);
}
