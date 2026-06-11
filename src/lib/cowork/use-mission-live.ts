"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCoworkMissionDetail } from "@/app/actions/cowork-submit";
import type { MissionWithDetails } from "@/lib/types";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

/**
 * 订阅单个 mission 的实时详情。首屏拉一次 `getCoworkMissionDetail`,再订阅
 * `/api/missions/[id]/progress` 的**具名** SSE 事件(mission-init /
 * mission-progress / task-update)——任一事件触发即重拉整份详情(MVP 简单稳健);
 * mission 进入终态后自动关闭 SSE。
 *
 * 注意:progress 端点发的是具名事件,`EventSource.onmessage` 收不到,必须
 * `addEventListener`,否则首屏拉取后再无更新。
 *
 * 被 cowork 右栏任务面板(步骤清单)与对话流步骤气泡共用。
 */
export function useMissionLive(missionId: string | null): {
  mission: MissionWithDetails | null;
  loading: boolean;
} {
  const [mission, setMission] = useState<MissionWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const refetch = useCallback(async (id: string) => {
    const m = await getCoworkMissionDetail(id);
    setMission(m);
    return m;
  }, []);

  useEffect(() => {
    esRef.current?.close();
    esRef.current = null;
    setMission(null);
    if (!missionId) return;

    let cancelled = false;
    setLoading(true);
    refetch(missionId).finally(() => {
      if (!cancelled) setLoading(false);
    });

    const es = new EventSource(`/api/missions/${missionId}/progress`);
    esRef.current = es;
    const onProgress = async () => {
      const m = await refetch(missionId);
      if (m && TERMINAL.has(m.status)) {
        es.close();
        esRef.current = null;
      }
    };
    es.addEventListener("mission-init", onProgress);
    es.addEventListener("mission-progress", onProgress);
    es.addEventListener("task-update", onProgress);
    es.onerror = () => {
      es.close();
      esRef.current = null;
    };

    return () => {
      cancelled = true;
      es.close();
      esRef.current = null;
    };
  }, [missionId, refetch]);

  return { mission, loading };
}
