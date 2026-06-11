/**
 * 会话页右侧 mission 抽屉的状态。默认收起;点对话里的 mission 卡片(focus)
 * 打开并锁定该 mission;关闭按钮收起但保留 missionId(便于再次打开)。纯函数,单测。
 */
export interface MissionDrawerState {
  missionId: string | null;
  open: boolean;
}

export type MissionDrawerAction =
  | { type: "focus"; missionId: string }
  | { type: "pending" }
  | { type: "open" }
  | { type: "close" };

export function missionDrawerReducer(
  state: MissionDrawerState,
  action: MissionDrawerAction,
): MissionDrawerState {
  switch (action.type) {
    case "focus":
      return { missionId: action.missionId, open: true };
    // 发送瞬间乐观打开抽屉(尚无 missionId → 抽屉显 loading),mission 解析好后
    // 再 focus 加载。让"输入即弹出执行面板",不必等结果回来后点卡片。
    case "pending":
      return { missionId: null, open: true };
    case "open":
      return state.missionId ? { ...state, open: true } : state;
    case "close":
      return { ...state, open: false };
    default:
      return state;
  }
}
