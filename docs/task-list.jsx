import { useState, useEffect } from "react";

// ── Mock Data ─────────────────────────────────────────────
const TASKS = [
  {
    id: "mission-001",
    title: "新能源汽车2026 Q1市场格局深度分析",
    scenario: "深度报道",
    status: "running",
    progress: 36,
    currentPhase: "并行执行",
    phaseIndex: 3,
    team: [
      { name: "小策", emoji: "🎯", color: "#FF6B35", role: "leader" },
      { name: "小雷", emoji: "⚡", color: "#00D4FF", role: "member" },
      { name: "小资", emoji: "📊", color: "#A855F7", role: "member" },
      { name: "小文", emoji: "✍️", color: "#10B981", role: "member" },
      { name: "小审", emoji: "🔍", color: "#F59E0B", role: "member" },
      { name: "小发", emoji: "🚀", color: "#EC4899", role: "member" },
    ],
    subtasks: { total: 6, done: 1, working: 2, waiting: 3 },
    messages: 11,
    createdAt: "2026-03-21 14:30",
    estimatedTime: "~8 分钟",
    lastActivity: "小资: 图表已生成6张，含趋势图、饼图...",
    lastActivityTime: "2 分钟前",
  },
  {
    id: "mission-002",
    title: "两会期间教育政策解读专题",
    scenario: "专题策划",
    status: "running",
    progress: 72,
    currentPhase: "协调收口",
    phaseIndex: 4,
    team: [
      { name: "小策", emoji: "🎯", color: "#FF6B35", role: "leader" },
      { name: "小雷", emoji: "⚡", color: "#00D4FF", role: "member" },
      { name: "小文", emoji: "✍️", color: "#10B981", role: "member" },
      { name: "小审", emoji: "🔍", color: "#F59E0B", role: "member" },
    ],
    subtasks: { total: 5, done: 3, working: 1, waiting: 1 },
    messages: 24,
    createdAt: "2026-03-21 13:15",
    estimatedTime: "~12 分钟",
    lastActivity: "小审: 第二稿审核通过，建议补充一段专家引言",
    lastActivityTime: "5 分钟前",
  },
  {
    id: "mission-003",
    title: "春分节气短视频批量生产（5条）",
    scenario: "短视频矩阵",
    status: "done",
    progress: 100,
    currentPhase: "已交付",
    phaseIndex: 5,
    team: [
      { name: "小策", emoji: "🎯", color: "#FF6B35", role: "leader" },
      { name: "小文", emoji: "✍️", color: "#10B981", role: "member" },
      { name: "小剪", emoji: "🎬", color: "#6366F1", role: "member" },
      { name: "小发", emoji: "🚀", color: "#EC4899", role: "member" },
    ],
    subtasks: { total: 8, done: 8, working: 0, waiting: 0 },
    messages: 31,
    createdAt: "2026-03-21 10:00",
    estimatedTime: "15 分钟",
    lastActivity: "小策: 全部任务已完成，5条短视频已分发至3个平台",
    lastActivityTime: "1 小时前",
  },
  {
    id: "mission-004",
    title: "突发：某地化工厂爆炸舆情快报",
    scenario: "舆情快报",
    status: "done",
    progress: 100,
    currentPhase: "已交付",
    phaseIndex: 5,
    team: [
      { name: "小策", emoji: "🎯", color: "#FF6B35", role: "leader" },
      { name: "小雷", emoji: "⚡", color: "#00D4FF", role: "member" },
      { name: "小数", emoji: "📈", color: "#14B8A6", role: "member" },
      { name: "小文", emoji: "✍️", color: "#10B981", role: "member" },
    ],
    subtasks: { total: 4, done: 4, working: 0, waiting: 0 },
    messages: 18,
    createdAt: "2026-03-21 09:12",
    estimatedTime: "5 分钟",
    lastActivity: "小策: 舆情快报已生成并推送至编辑部",
    lastActivityTime: "3 小时前",
  },
  {
    id: "mission-005",
    title: "周末文旅推荐图文（成都站）",
    scenario: "图文创作",
    status: "error",
    progress: 45,
    currentPhase: "异常中断",
    phaseIndex: 3,
    team: [
      { name: "小策", emoji: "🎯", color: "#FF6B35", role: "leader" },
      { name: "小雷", emoji: "⚡", color: "#00D4FF", role: "member" },
      { name: "小文", emoji: "✍️", color: "#10B981", role: "member" },
    ],
    subtasks: { total: 4, done: 1, working: 0, waiting: 3 },
    messages: 8,
    createdAt: "2026-03-21 11:40",
    estimatedTime: "~6 分钟",
    lastActivity: "小策: ⚠ 小雷在景点数据抓取时遇到接口超时，等待重试",
    lastActivityTime: "45 分钟前",
  },
  {
    id: "mission-006",
    title: "3·15消费者权益日回顾长图",
    scenario: "长图设计",
    status: "queued",
    progress: 0,
    currentPhase: "排队中",
    phaseIndex: 0,
    team: [],
    subtasks: { total: 0, done: 0, working: 0, waiting: 0 },
    messages: 0,
    createdAt: "2026-03-21 14:52",
    estimatedTime: "~10 分钟",
    lastActivity: "等待资源分配...",
    lastActivityTime: "刚刚",
  },
];

const SCENARIOS = ["全部", "深度报道", "专题策划", "短视频矩阵", "舆情快报", "图文创作", "长图设计"];
const STATUS_FILTERS = [
  { key: "all", label: "全部", color: "#94A3B8" },
  { key: "running", label: "执行中", color: "#00D4FF" },
  { key: "done", label: "已完成", color: "#10B981" },
  { key: "error", label: "异常", color: "#EF4444" },
  { key: "queued", label: "排队中", color: "#64748B" },
];

const statusConfig = {
  running: { label: "执行中", color: "#00D4FF", bg: "#00D4FF15", icon: "⚡" },
  done: { label: "已完成", color: "#10B981", bg: "#10B98115", icon: "✓" },
  error: { label: "异常", color: "#EF4444", bg: "#EF444415", icon: "!" },
  queued: { label: "排队中", color: "#64748B", bg: "#64748B15", icon: "⏳" },
};

const PHASES = ["组队", "拆解", "执行", "协调", "交付"];

export default function TaskList() {
  const [filter, setFilter] = useState("all");
  const [scenarioFilter, setScenarioFilter] = useState("全部");
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState("list"); // list | card
  const [selectedTask, setSelectedTask] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const filtered = TASKS.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (scenarioFilter !== "全部" && t.scenario !== scenarioFilter) return false;
    if (searchText && !t.title.includes(searchText)) return false;
    return true;
  });

  const stats = {
    total: TASKS.length,
    running: TASKS.filter((t) => t.status === "running").length,
    done: TASKS.filter((t) => t.status === "done").length,
    error: TASKS.filter((t) => t.status === "error").length,
    queued: TASKS.filter((t) => t.status === "queued").length,
  };

  return (
    <div style={S.root}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Header ── */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.logo}>
            <span style={S.logoIcon}>潮</span>
            <div>
              <div style={S.logoTitle}>VibeTide · 任务中心</div>
              <div style={S.logoSub}>AI MULTI-AGENT WORKSPACE</div>
            </div>
          </div>
        </div>
        <div style={S.headerRight}>
          <button style={S.newTaskBtn} onClick={() => {}}>
            <span style={{ fontSize: 16 }}>＋</span>
            新建任务
          </button>
        </div>
      </header>

      {/* ── Stats Row ── */}
      <div style={S.statsRow}>
        {[
          { label: "总任务", value: stats.total, color: "#94A3B8", sub: "今日" },
          { label: "执行中", value: stats.running, color: "#00D4FF", sub: "进行中" },
          { label: "已完成", value: stats.done, color: "#10B981", sub: "今日完成" },
          { label: "异常", value: stats.error, color: "#EF4444", sub: "需关注" },
          { label: "排队中", value: stats.queued, color: "#64748B", sub: "等待中" },
        ].map((s) => (
          <div key={s.label} style={S.statCard} onClick={() => setFilter(s.label === "总任务" ? "all" : s.label === "执行中" ? "running" : s.label === "已完成" ? "done" : s.label === "异常" ? "error" : "queued")}>
            <div style={{ ...S.statValue, color: s.color }}>{s.value}</div>
            <div style={S.statLabel}>{s.label}</div>
            <div style={S.statSub}>{s.sub}</div>
          </div>
        ))}

        {/* Mini utilization chart */}
        <div style={S.utilizationCard}>
          <div style={S.utilizationTitle}>智能体负载</div>
          <div style={S.utilizationBars}>
            {[
              { name: "小策", load: 80, color: "#FF6B35" },
              { name: "小雷", load: 65, color: "#00D4FF" },
              { name: "小资", load: 45, color: "#A855F7" },
              { name: "小文", load: 70, color: "#10B981" },
              { name: "小审", load: 30, color: "#F59E0B" },
              { name: "小发", load: 20, color: "#EC4899" },
            ].map((a) => (
              <div key={a.name} style={S.utilizationRow}>
                <span style={S.utilizationName}>{a.name}</span>
                <div style={S.utilizationTrack}>
                  <div style={{ ...S.utilizationFill, width: `${a.load}%`, background: a.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={S.filterRow}>
        <div style={S.filterGroup}>
          {STATUS_FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{ ...S.filterBtn, ...(filter === f.key ? { background: `${f.color}18`, color: f.color, borderColor: `${f.color}40` } : {}) }}>
              {f.key !== "all" && <span style={{ ...S.filterDot, background: f.color }} />}
              {f.label}
              {f.key === "all" ? ` (${stats.total})` : ` (${stats[f.key]})`}
            </button>
          ))}
        </div>
        <div style={S.filterRight}>
          <div style={S.searchBox}>
            <span style={{ color: "#475569" }}>🔍</span>
            <input type="text" placeholder="搜索任务名称..." value={searchText} onChange={(e) => setSearchText(e.target.value)} style={S.searchInput} />
          </div>
          <select value={scenarioFilter} onChange={(e) => setScenarioFilter(e.target.value)} style={S.scenarioSelect}>
            {SCENARIOS.map((s) => (
              <option key={s} value={s}>{s === "全部" ? "全部场景" : s}</option>
            ))}
          </select>
          <div style={S.viewToggle}>
            <button onClick={() => setViewMode("list")} style={{ ...S.viewBtn, ...(viewMode === "list" ? S.viewBtnActive : {}) }}>☰</button>
            <button onClick={() => setViewMode("card")} style={{ ...S.viewBtn, ...(viewMode === "card" ? S.viewBtnActive : {}) }}>▦</button>
          </div>
        </div>
      </div>

      {/* ── Task List ── */}
      <div style={S.listContainer}>
        {viewMode === "list" ? (
          <div style={S.table}>
            {/* Table Header */}
            <div style={S.tableHeader}>
              <div style={{ ...S.th, flex: "0 0 70px" }}>状态</div>
              <div style={{ ...S.th, flex: 1 }}>任务名称</div>
              <div style={{ ...S.th, flex: "0 0 80px" }}>场景</div>
              <div style={{ ...S.th, flex: "0 0 100px" }}>进度</div>
              <div style={{ ...S.th, flex: "0 0 80px" }}>阶段</div>
              <div style={{ ...S.th, flex: "0 0 140px" }}>团队</div>
              <div style={{ ...S.th, flex: "0 0 80px" }}>子任务</div>
              <div style={{ ...S.th, flex: "0 0 50px" }}>消息</div>
              <div style={{ ...S.th, flex: "0 0 240px" }}>最新动态</div>
            </div>

            {/* Table Body */}
            {filtered.map((task) => {
              const sc = statusConfig[task.status];
              const isSelected = selectedTask === task.id;
              return (
                <div key={task.id}>
                  <div onClick={() => setSelectedTask(isSelected ? null : task.id)} style={{ ...S.tableRow, borderLeftColor: sc.color, background: isSelected ? "#0F172A" : "transparent" }}>
                    {/* Status */}
                    <div style={{ ...S.td, flex: "0 0 70px" }}>
                      <span style={{ ...S.statusBadge, background: sc.bg, color: sc.color }}>
                        {task.status === "running" && <span style={S.runningDot} />}
                        {sc.label}
                      </span>
                    </div>

                    {/* Title */}
                    <div style={{ ...S.td, flex: 1 }}>
                      <div style={S.taskTitle}>{task.title}</div>
                      <div style={S.taskMeta}>{task.createdAt} · 预计{task.estimatedTime}</div>
                    </div>

                    {/* Scenario */}
                    <div style={{ ...S.td, flex: "0 0 80px" }}>
                      <span style={S.scenarioBadge}>{task.scenario}</span>
                    </div>

                    {/* Progress */}
                    <div style={{ ...S.td, flex: "0 0 100px" }}>
                      <div style={S.progressWrap}>
                        <div style={S.progressTrack}>
                          <div style={{ ...S.progressFill, width: `${task.progress}%`, background: task.status === "error" ? "#EF4444" : task.status === "done" ? "#10B981" : "#00D4FF" }} />
                        </div>
                        <span style={{ ...S.progressNum, color: sc.color }}>{task.progress}%</span>
                      </div>
                    </div>

                    {/* Phase */}
                    <div style={{ ...S.td, flex: "0 0 80px" }}>
                      <span style={{ ...S.phaseBadge, color: sc.color }}>{task.currentPhase}</span>
                    </div>

                    {/* Team */}
                    <div style={{ ...S.td, flex: "0 0 140px" }}>
                      <div style={S.teamStack}>
                        {task.team.slice(0, 5).map((m, i) => (
                          <span key={i} title={m.name} style={{ ...S.teamAvatar, background: `${m.color}20`, border: `1.5px solid ${m.color}60`, zIndex: 10 - i, marginLeft: i > 0 ? -6 : 0 }}>
                            {m.emoji}
                          </span>
                        ))}
                        {task.team.length > 5 && <span style={S.teamMore}>+{task.team.length - 5}</span>}
                        {task.team.length === 0 && <span style={S.noTeam}>—</span>}
                        {task.team.length > 0 && <span style={S.teamCount}>{task.team.length}人</span>}
                      </div>
                    </div>

                    {/* Subtasks */}
                    <div style={{ ...S.td, flex: "0 0 80px" }}>
                      {task.subtasks.total > 0 ? (
                        <div style={S.subtaskInfo}>
                          <span style={{ color: "#10B981", fontWeight: 600 }}>{task.subtasks.done}</span>
                          <span style={{ color: "#475569" }}>/</span>
                          <span>{task.subtasks.total}</span>
                        </div>
                      ) : (
                        <span style={{ color: "#334155" }}>—</span>
                      )}
                    </div>

                    {/* Messages */}
                    <div style={{ ...S.td, flex: "0 0 50px" }}>
                      {task.messages > 0 ? (
                        <span style={S.msgCount}>💬 {task.messages}</span>
                      ) : (
                        <span style={{ color: "#334155" }}>—</span>
                      )}
                    </div>

                    {/* Last Activity */}
                    <div style={{ ...S.td, flex: "0 0 240px" }}>
                      <div style={S.activityPreview}>{task.lastActivity}</div>
                      <div style={S.activityTime}>{task.lastActivityTime}</div>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isSelected && (
                    <div style={S.expandedPanel}>
                      <div style={S.expandedGrid}>
                        {/* Phase Progress */}
                        <div style={S.expandedSection}>
                          <div style={S.expandedLabel}>任务阶段</div>
                          <div style={S.phaseSteps}>
                            {PHASES.map((p, i) => {
                              const idx = i + 1;
                              const isDone = idx < task.phaseIndex;
                              const isActive = idx === task.phaseIndex;
                              const isError = task.status === "error" && isActive;
                              return (
                                <div key={p} style={S.phaseStep}>
                                  <div style={{ ...S.phaseStepDot, background: isError ? "#EF4444" : isDone ? "#10B981" : isActive ? "#00D4FF" : "#334155", boxShadow: isActive ? `0 0 8px ${isError ? "#EF4444" : "#00D4FF"}60` : "none" }}>
                                    {isDone ? "✓" : isError ? "!" : idx}
                                  </div>
                                  <span style={{ ...S.phaseStepLabel, color: isDone || isActive ? "#E2E8F0" : "#475569" }}>{p}</span>
                                  {i < 4 && <span style={{ ...S.phaseStepLine, background: isDone ? "#10B981" : "#1E293B" }} />}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Subtask Breakdown */}
                        <div style={S.expandedSection}>
                          <div style={S.expandedLabel}>子任务分布</div>
                          <div style={S.subtaskBar}>
                            {task.subtasks.done > 0 && <div style={{ ...S.subtaskSeg, flex: task.subtasks.done, background: "#10B981" }} title={`已完成 ${task.subtasks.done}`} />}
                            {task.subtasks.working > 0 && <div style={{ ...S.subtaskSeg, flex: task.subtasks.working, background: "#00D4FF" }} title={`执行中 ${task.subtasks.working}`} />}
                            {task.subtasks.waiting > 0 && <div style={{ ...S.subtaskSeg, flex: task.subtasks.waiting, background: "#334155" }} title={`等待中 ${task.subtasks.waiting}`} />}
                          </div>
                          <div style={S.subtaskLegend}>
                            <span><span style={{ ...S.legendDot, background: "#10B981" }} />已完成 {task.subtasks.done}</span>
                            <span><span style={{ ...S.legendDot, background: "#00D4FF" }} />执行中 {task.subtasks.working}</span>
                            <span><span style={{ ...S.legendDot, background: "#334155" }} />等待 {task.subtasks.waiting}</span>
                          </div>
                        </div>

                        {/* Team Detail */}
                        <div style={S.expandedSection}>
                          <div style={S.expandedLabel}>团队成员</div>
                          <div style={S.teamDetail}>
                            {task.team.map((m) => (
                              <div key={m.name} style={S.teamMember}>
                                <span style={{ ...S.teamMemberAvatar, background: `${m.color}20` }}>{m.emoji}</span>
                                <span style={{ ...S.teamMemberName, color: m.color }}>{m.name}</span>
                                {m.role === "leader" && <span style={S.leaderTag}>Leader</span>}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Action */}
                        <div style={{ ...S.expandedSection, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
                          <button style={S.enterBtn} onClick={() => {}}>
                            进入任务详情 →
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div style={S.emptyState}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
                <div style={{ color: "#64748B" }}>没有匹配的任务</div>
              </div>
            )}
          </div>
        ) : (
          /* Card View */
          <div style={S.cardGrid}>
            {filtered.map((task) => {
              const sc = statusConfig[task.status];
              return (
                <div key={task.id} style={{ ...S.card, borderTopColor: sc.color }}>
                  <div style={S.cardHeader}>
                    <span style={{ ...S.statusBadge, background: sc.bg, color: sc.color }}>
                      {task.status === "running" && <span style={S.runningDot} />}
                      {sc.label}
                    </span>
                    <span style={S.scenarioBadge}>{task.scenario}</span>
                  </div>
                  <div style={S.cardTitle}>{task.title}</div>

                  <div style={S.cardProgressRow}>
                    <div style={S.progressTrack}>
                      <div style={{ ...S.progressFill, width: `${task.progress}%`, background: task.status === "error" ? "#EF4444" : task.status === "done" ? "#10B981" : "#00D4FF" }} />
                    </div>
                    <span style={{ ...S.progressNum, color: sc.color }}>{task.progress}%</span>
                  </div>

                  <div style={S.cardTeamRow}>
                    <div style={S.teamStack}>
                      {task.team.slice(0, 4).map((m, i) => (
                        <span key={i} style={{ ...S.teamAvatar, background: `${m.color}20`, border: `1.5px solid ${m.color}60`, zIndex: 10 - i, marginLeft: i > 0 ? -6 : 0, width: 26, height: 26, fontSize: 13 }}>
                          {m.emoji}
                        </span>
                      ))}
                      {task.team.length > 4 && <span style={{ ...S.teamMore, fontSize: 10 }}>+{task.team.length - 4}</span>}
                    </div>
                    <span style={{ ...S.phaseBadge, color: sc.color, fontSize: 10 }}>{task.currentPhase}</span>
                  </div>

                  <div style={S.cardFooter}>
                    <div style={S.cardActivity}>{task.lastActivity.length > 40 ? task.lastActivity.slice(0, 40) + "..." : task.lastActivity}</div>
                    <div style={S.cardTime}>{task.lastActivityTime}</div>
                  </div>

                  <div style={S.cardActions}>
                    <div style={S.cardSubtasks}>
                      <span style={{ color: "#10B981" }}>{task.subtasks.done}</span>/{task.subtasks.total} 子任务
                    </div>
                    <button style={S.cardEnterBtn}>详情 →</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes pulse-ring { 0%{box-shadow:0 0 0 0 rgba(0,212,255,.4)} 70%{box-shadow:0 0 0 4px rgba(0,212,255,0)} 100%{box-shadow:0 0 0 0 rgba(0,212,255,0)} }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #1E293B; border-radius: 3px; }
  input, select, button { font-family: inherit; }
`;

const font = "'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', -apple-system, sans-serif";
const mono = "'Courier New', 'Menlo', monospace";

const S = {
  root: { fontFamily: font, background: "#070B14", color: "#E2E8F0", minHeight: "100vh", fontSize: 13, display: "flex", flexDirection: "column" },

  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", background: "#0B1120", borderBottom: "1px solid #1E293B", flexShrink: 0 },
  headerLeft: {},
  headerRight: {},
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoIcon: { width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #00D4FF, #0066FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#fff" },
  logoTitle: { fontSize: 15, fontWeight: 600, letterSpacing: 0.5 },
  logoSub: { fontSize: 10, color: "#64748B", fontFamily: mono, letterSpacing: 1.5 },
  newTaskBtn: { display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, border: "1px solid #00D4FF40", background: "#00D4FF12", color: "#00D4FF", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .2s" },

  statsRow: { display: "flex", gap: 12, padding: "18px 28px", borderBottom: "1px solid #1E293B0A", flexShrink: 0 },
  statCard: { padding: "12px 16px", borderRadius: 10, background: "#0B1120", border: "1px solid #1E293B", cursor: "pointer", minWidth: 90, transition: "all .2s", textAlign: "center" },
  statValue: { fontSize: 28, fontWeight: 700, fontFamily: mono },
  statLabel: { fontSize: 11, color: "#94A3B8", fontWeight: 500, marginTop: 2 },
  statSub: { fontSize: 10, color: "#334155", marginTop: 2 },
  utilizationCard: { flex: 1, padding: "10px 16px", borderRadius: 10, background: "#0B1120", border: "1px solid #1E293B", marginLeft: 8 },
  utilizationTitle: { fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  utilizationBars: { display: "flex", flexDirection: "column", gap: 4 },
  utilizationRow: { display: "flex", alignItems: "center", gap: 6 },
  utilizationName: { fontSize: 11, color: "#94A3B8", width: 28, textAlign: "right" },
  utilizationTrack: { flex: 1, height: 6, borderRadius: 3, background: "#1E293B", overflow: "hidden" },
  utilizationFill: { height: "100%", borderRadius: 3, transition: "width .5s" },

  filterRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 28px", flexShrink: 0, gap: 12, flexWrap: "wrap" },
  filterGroup: { display: "flex", gap: 6 },
  filterBtn: { display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: "1px solid #1E293B", background: "transparent", color: "#64748B", fontSize: 12, cursor: "pointer", transition: "all .2s" },
  filterDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  filterRight: { display: "flex", alignItems: "center", gap: 8 },
  searchBox: { display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, border: "1px solid #1E293B", background: "#0B1120" },
  searchInput: { background: "none", border: "none", outline: "none", color: "#E2E8F0", fontSize: 12, width: 140 },
  scenarioSelect: { padding: "5px 10px", borderRadius: 6, border: "1px solid #1E293B", background: "#0B1120", color: "#94A3B8", fontSize: 12, outline: "none", cursor: "pointer" },
  viewToggle: { display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #1E293B" },
  viewBtn: { padding: "5px 10px", background: "transparent", border: "none", color: "#475569", fontSize: 14, cursor: "pointer" },
  viewBtnActive: { background: "#1E293B", color: "#E2E8F0" },

  listContainer: { flex: 1, padding: "0 28px 28px", overflowY: "auto" },

  table: {},
  tableHeader: { display: "flex", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid #1E293B", position: "sticky", top: 0, background: "#070B14", zIndex: 5 },
  th: { fontSize: 10, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: 1.2 },
  tableRow: { display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #0F172A", borderLeft: "3px solid transparent", cursor: "pointer", transition: "all .15s" },
  td: { display: "flex", flexDirection: "column", justifyContent: "center", paddingRight: 8 },

  statusBadge: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 5, fontFamily: mono, whiteSpace: "nowrap" },
  runningDot: { width: 5, height: 5, borderRadius: "50%", background: "currentColor", animation: "blink 1.5s ease-in-out infinite", flexShrink: 0 },

  taskTitle: { fontSize: 13, fontWeight: 600, color: "#F1F5F9", lineHeight: 1.3 },
  taskMeta: { fontSize: 10, color: "#475569", marginTop: 2 },

  scenarioBadge: { fontSize: 10, fontWeight: 500, color: "#94A3B8", background: "#1E293B", padding: "2px 8px", borderRadius: 4 },

  progressWrap: { display: "flex", alignItems: "center", gap: 6 },
  progressTrack: { flex: 1, height: 5, borderRadius: 3, background: "#1E293B", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3, transition: "width .5s" },
  progressNum: { fontSize: 12, fontWeight: 600, fontFamily: mono, minWidth: 32, textAlign: "right" },

  phaseBadge: { fontSize: 11, fontWeight: 500 },

  teamStack: { display: "flex", alignItems: "center" },
  teamAvatar: { width: 28, height: 28, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14 },
  teamMore: { fontSize: 11, color: "#475569", marginLeft: 4, fontFamily: mono },
  teamCount: { fontSize: 10, color: "#475569", marginLeft: 6 },
  noTeam: { color: "#334155" },

  subtaskInfo: { display: "flex", alignItems: "center", gap: 2, fontSize: 13, fontFamily: mono },

  msgCount: { fontSize: 11, color: "#64748B" },

  activityPreview: { fontSize: 11, color: "#94A3B8", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 230 },
  activityTime: { fontSize: 10, color: "#334155", marginTop: 2 },

  // Expanded Panel
  expandedPanel: { padding: "16px 16px 16px 19px", background: "#0B1120", borderBottom: "1px solid #1E293B" },
  expandedGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 20 },
  expandedSection: {},
  expandedLabel: { fontSize: 10, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 },

  phaseSteps: { display: "flex", alignItems: "center" },
  phaseStep: { display: "flex", alignItems: "center", gap: 4 },
  phaseStepDot: { width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 600, flexShrink: 0 },
  phaseStepLabel: { fontSize: 11, whiteSpace: "nowrap" },
  phaseStepLine: { width: 20, height: 2, borderRadius: 1, margin: "0 2px" },

  subtaskBar: { display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 },
  subtaskSeg: { borderRadius: 4, minWidth: 4 },
  subtaskLegend: { display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: "#94A3B8" },
  legendDot: { display: "inline-block", width: 6, height: 6, borderRadius: "50%", marginRight: 4, verticalAlign: "middle" },

  teamDetail: { display: "flex", gap: 8, flexWrap: "wrap" },
  teamMember: { display: "flex", alignItems: "center", gap: 4 },
  teamMemberAvatar: { width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 },
  teamMemberName: { fontSize: 12, fontWeight: 500 },
  leaderTag: { fontSize: 8, fontWeight: 700, color: "#FF6B35", background: "#FF6B3518", padding: "1px 4px", borderRadius: 3, fontFamily: mono },

  enterBtn: { padding: "8px 18px", borderRadius: 8, border: "1px solid #00D4FF40", background: "#00D4FF12", color: "#00D4FF", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },

  // Card View
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 },
  card: { padding: 18, borderRadius: 12, background: "#0B1120", border: "1px solid #1E293B", borderTop: "3px solid", cursor: "pointer", transition: "all .2s", display: "flex", flexDirection: "column", gap: 10 },
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 14, fontWeight: 600, color: "#F1F5F9", lineHeight: 1.4 },
  cardProgressRow: { display: "flex", alignItems: "center", gap: 8 },
  cardTeamRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  cardFooter: { borderTop: "1px solid #1E293B", paddingTop: 8 },
  cardActivity: { fontSize: 11, color: "#64748B", lineHeight: 1.4 },
  cardTime: { fontSize: 10, color: "#334155", marginTop: 2 },
  cardActions: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  cardSubtasks: { fontSize: 11, color: "#64748B", fontFamily: mono },
  cardEnterBtn: { padding: "4px 12px", borderRadius: 5, border: "1px solid #1E293B", background: "transparent", color: "#94A3B8", fontSize: 11, cursor: "pointer" },

  emptyState: { textAlign: "center", padding: 60, color: "#475569" },
};
