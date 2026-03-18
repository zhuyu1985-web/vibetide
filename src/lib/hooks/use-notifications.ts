"use client";

import { useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import type { TeamMessage } from "@/lib/types";

function getNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "default" as NotificationPermission;
  }
  return Notification.permission;
}

function subscribeToPermission(callback: () => void) {
  // Notification permission doesn't have a change event,
  // so we poll lightly on visibility change as a proxy
  const handler = () => callback();
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}

/**
 * useNotifications — manages browser notification permission and
 * shows desktop notifications for alert / decision_request messages.
 */
export function useNotifications(messages?: TeamMessage[]) {
  const permission = useSyncExternalStore(
    subscribeToPermission,
    getNotificationPermission,
    () => "default" as NotificationPermission,
  );
  const previousIdsRef = useRef<Set<string>>(new Set());
  const hasRequestedRef = useRef(false);

  // Request permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (hasRequestedRef.current) return;

    if (Notification.permission === "default") {
      hasRequestedRef.current = true;
      Notification.requestPermission();
    }
  }, []);

  // Track seen message IDs and show notification for new ones
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    if (permission !== "granted") return;

    const importantTypes = new Set(["alert", "decision_request"]);
    const prevIds = previousIdsRef.current;

    for (const msg of messages) {
      if (prevIds.has(msg.id)) continue;
      if (!importantTypes.has(msg.type)) {
        prevIds.add(msg.id);
        continue;
      }

      // This is a new important message — show desktop notification
      const title =
        msg.type === "alert" ? "Vibe Media - 预警通知" : "Vibe Media - 待审批";
      const body =
        msg.content.length > 100
          ? msg.content.slice(0, 100) + "..."
          : msg.content;

      try {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: msg.id, // prevent duplicates
        });
      } catch {
        // Notification constructor may fail in some environments
      }

      prevIds.add(msg.id);
    }
  }, [messages, permission]);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    await Notification.requestPermission();
  }, []);

  return {
    permission,
    requestPermission,
    isSupported:
      typeof window !== "undefined" && "Notification" in window,
  };
}
