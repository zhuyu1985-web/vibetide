"use client";
import { useEffect } from "react";

export function ChangelogClient() {
  useEffect(() => {
    try {
      localStorage.setItem("vibetide-help-changelog-last-seen", String(Date.now()));
    } catch {
      // 隐私模式 / SSR 失败安全
    }
  }, []);
  return null;
}
