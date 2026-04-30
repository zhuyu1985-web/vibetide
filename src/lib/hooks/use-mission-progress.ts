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
  // 用 React 官方 "store info from prev render" 模式替代 effect 内的同步 setState：
  // 当 missionId 切换时在 render 里直接 setState 重置（React 会丢弃当前渲染并用新值重渲），
  // 比 effect 内 setState 少一次级联渲染。
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevMissionId, setPrevMissionId] = useState(missionId);
  const [state, setState] = useState<MissionProgressData>(emptyMissionProgress);
  const [isLoading, setIsLoading] = useState(true);

  if (prevMissionId !== missionId) {
    setPrevMissionId(missionId);
    setState(emptyMissionProgress());
    setIsLoading(true);
  }

  useEffect(() => {
    if (!missionId) return;

    const es = new EventSource(`/api/missions/${missionId}/progress`);

    const onEvent = (name: MissionEventName) => (ev: Event) => {
      const me = ev as MessageEvent;
      setIsLoading(false);
      setState((prev) => applyMissionEvent(prev, name, me.data));
    };

    es.addEventListener("mission-init", onEvent("mission-init"));
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
