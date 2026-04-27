"use client";

import { useEffect, useState } from "react";
import {
  applyMissionEvent,
  emptyMissionProgress,
  type MissionProgressData,
  type MissionEventName,
} from "@/lib/chat/parse-mission-event";

export function useMissionProgress(missionId: string): MissionProgressData & {
  isLoading: boolean;
} {
  const [state, setState] = useState<MissionProgressData>(emptyMissionProgress);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!missionId) return;
    setState(emptyMissionProgress());
    setIsLoading(true);

    const es = new EventSource(`/api/missions/${missionId}/progress`);

    const onEvent = (name: MissionEventName) => (ev: Event) => {
      const me = ev as MessageEvent;
      setIsLoading(false);
      setState((prev) => applyMissionEvent(prev, name, me.data));
    };

    es.addEventListener("task-update", onEvent("task-update"));
    es.addEventListener("mission-progress", onEvent("mission-progress"));
    es.addEventListener("mission-completed", (ev) => {
      onEvent("mission-completed")(ev);
      es.close();
    });
    es.addEventListener("error", (ev) => {
      // SSE 错误事件可能无 data；如果有 data 走 applyMissionEvent，否则忽略
      if ((ev as MessageEvent).data) {
        onEvent("error")(ev);
      }
    });

    return () => es.close();
  }, [missionId]);

  return { ...state, isLoading };
}
