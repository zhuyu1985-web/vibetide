"use client";

import { CoworkMissionPanel } from "./cowork-mission-panel";

/**
 * 会话页右侧 mission 抽屉:默认收起(open=false 时不渲染,对话流占满宽度);
 * 点对话里的 mission 卡片 → open=true 从右滑出。内部复用 CoworkMissionPanel
 * (含具名 SSE 实时打勾),关闭按钮回调 onClose。
 */
export function MissionDrawer({
  missionId,
  open,
  onClose,
}: {
  missionId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !missionId) return null;
  return (
    <div className="flex-none animate-in fade-in slide-in-from-right-4 duration-200">
      <CoworkMissionPanel missionId={missionId} onClose={onClose} />
    </div>
  );
}
