import { useState, useEffect, useRef, useCallback } from "react";

// ── Data ──────────────────────────────────────────────────
const AGENTS = [
  { id: "xiaece", name: "小策", role: "策划总控 · Team Leader", emoji: "🎯", color: "#FF6B35", status: "coordinating" },
  { id: "xiaolei", name: "小雷", role: "线索猎手", emoji: "⚡", color: "#00D4FF", status: "working" },
  { id: "xiaozi", name: "小资", role: "数据分析师", emoji: "📊", color: "#A855F7", status: "working" },
  { id: "xiaowen", name: "小文", role: "内容创作者", emoji: "✍️", color: "#10B981", status: "waiting" },
  { id: "xiaoshen", name: "小审", role: "质量审核", emoji: "🔍", color: "#F59E0B", status: "idle" },
  { id: "xiaofa", name: "小发", role: "分发运营", emoji: "🚀", color: "#EC4899", status: "idle" },
];

const TASKS_INIT = [
  { id: "t1", title: "选题策划与任务拆解", agent: "xiaece", status: "done", progress: 100, deps: [], phase: 1, output: "已生成选题方案：「新能源汽车2026年Q1市场格局深度分析」，共拆解为5个子任务" },
  { id: "t2", title: "全网素材搜集与整理", agent: "xiaolei", status: "working", progress: 72, deps: ["t1"], phase: 2, output: "已抓取38篇行业报告、127条新闻、15组核心数据..." },
  { id: "t3", title: "行业数据深度分析", agent: "xiaozi", status: "working", progress: 45, deps: ["t1"], phase: 2, output: "正在处理销量趋势、市占率变化、政策影响因子..." },
  { id: "t4", title: "深度报道稿件撰写", agent: "xiaowen", status: "waiting", progress: 0, deps: ["t2", "t3"], phase: 3, output: null },
  { id: "t5", title: "内容质量审核", agent: "xiaoshen", status: "locked", progress: 0, deps: ["t4"], phase: 4, output: null },
  { id: "t6", title: "多渠道分发准备", agent: "xiaofa", status: "locked", progress: 0, deps: ["t5"], phase: 5, output: null },
];

const PHASES = [
  { id: 1, label: "组队", icon: "👥" },
  { id: 2, label: "拆解", icon: "🧩" },
  { id: 3, label: "执行", icon: "⚙️" },
  { id: 4, label: "协调", icon: "🔄" },
  { id: 5, label: "交付", icon: "📦" },
];

const MESSAGES_POOL = [
  { from: "xiaece", to: "all", text: "团队已就位，任务已拆解完成。小雷、小资可以并行启动了。", time: 0 },
  { from: "xiaolei", to: "xiaozi", text: "小资，中汽协最新月报我已经拿到了，需要我把原始数据直接传给你吗？", time: 2 },
  { from: "xiaozi", to: "xiaolei", text: "好的，直接传吧。另外如果有各厂商的交付量对比数据也一起给我。", time: 4 },
  { from: "xiaolei", to: "xiaozi", text: "收到，交付量数据有两个口径，我都传给你，你选更权威的那个。", time: 6 },
  { from: "xiaolei", to: "xiaece", text: "队长，发现一条重要线索：某头部车企疑似在Q2有重大产品线调整，要不要深挖？", time: 9 },
  { from: "xiaece", to: "xiaolei", text: "好线索。先标记优先级P1，把初步信源整理好，后续让小文重点展开这个角度。", time: 11 },
  { from: "xiaozi", to: "xiaece", text: "数据初步分析完成，有一个发现：插混车型增速首次超过纯电，同比+47%。这个可以作为核心论点。", time: 14 },
  { from: "xiaece", to: "xiaowen", text: "小文注意，核心论点已确定：插混反超纯电。等素材和数据到位后，以此为主线组织稿件结构。", time: 16 },
  { from: "xiaowen", to: "xiaece", text: "收到队长，我先根据现有信息搭建稿件大纲框架，等数据和素材到位后直接填充。", time: 18 },
  { from: "xiaolei", to: "all", text: "素材搜集完成度已达85%，预计再需3分钟完成剩余政策文件的整理。", time: 21 },
  { from: "xiaozi", to: "xiaowen", text: "小文，我这边图表已经生成了6张，包括趋势图、市占率饼图、增速对比。随时可以调用。", time: 24 },
];

// ── Utility ───────────────────────────────────────────────
const getAgent = (id) => AGENTS.find((a) => a.id === id);
const statusLabel = (s) => ({ done: "已完成", working: "执行中", waiting: "等待中", locked: "未解锁", coordinating: "统筹中", idle: "待命" }[s] || s);
const statusColor = (s) => ({ done: "#10B981", working: "#00D4FF", waiting: "#F59E0B", locked: "#64748B", coordinating: "#FF6B35", idle: "#64748B" }[s] || "#64748B");

// ── Components ────────────────────────────────────────────
const Pulse = ({ color, size = 8 }) => (
  <span style={{ position: "relative", display: "inline-block", width: size, height: size, marginRight: 6 }}>
    <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.3, animation: "pulse 2s ease-in-out infinite" }} />
    <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
  </span>
);

export default function TaskCenter() {
  const [tasks, setTasks] = useState(TASKS_INIT);
  const [messages, setMessages] = useState([]);
  const [msgIndex, setMsgIndex] = useState(0);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [activeTab, setActiveTab] = useState("board"); // board | messages
  const [elapsedSec, setElapsedSec] = useState(0);
  const msgEndRef = useRef(null);
  const currentPhase = 3;

  // Simulate message stream
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec((p) => p + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (msgIndex < MESSAGES_POOL.length && elapsedSec >= MESSAGES_POOL[msgIndex].time) {
      const msg = { ...MESSAGES_POOL[msgIndex], ts: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) };
      setMessages((p) => [...p, msg]);
      setMsgIndex((p) => p + 1);
    }
  }, [elapsedSec, msgIndex]);

  // Simulate task progress
  useEffect(() => {
    const timer = setInterval(() => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.status === "working" && t.progress < 100) {
            const newP = Math.min(100, t.progress + Math.random() * 3);
            if (newP >= 100) return { ...t, progress: 100, status: "done" };
            return { ...t, progress: Math.round(newP) };
          }
          return t;
        })
      );
    }, 800);
    return () => clearInterval(timer);
  }, []);

  // Auto-unlock tasks when deps are done
  useEffect(() => {
    setTasks((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        if (t.status === "waiting" || t.status === "locked") {
          const depsComplete = t.deps.every((d) => prev.find((x) => x.id === d)?.status === "done");
          if (depsComplete && t.status !== "working") {
            changed = true;
            return { ...t, status: "working", progress: 0 };
          }
        }
        return t;
      });
      return changed ? next : prev;
    });
  }, [tasks]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const totalProgress = Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length);

  const agentStatus = useCallback(
    (agentId) => {
      const t = tasks.find((t) => t.agent === agentId && t.status === "working");
      if (t) return "working";
      const done = tasks.filter((t) => t.agent === agentId).every((t) => t.status === "done");
      if (done && tasks.some((t) => t.agent === agentId)) return "done";
      return "idle";
    },
    [tasks]
  );

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
              <div style={S.logoSub}>AI Multi-Agent Workspace</div>
            </div>
          </div>
        </div>
        <div style={S.headerCenter}>
          <div style={S.missionName}>
            <Pulse color="#00D4FF" size={6} />
            <span>深度报道 · 新能源汽车2026 Q1市场格局分析</span>
          </div>
          <div style={S.phaseBar}>
            {PHASES.map((p) => (
              <div key={p.id} style={{ ...S.phaseItem, opacity: p.id <= currentPhase ? 1 : 0.35 }}>
                <span style={{ ...S.phaseDot, background: p.id < currentPhase ? "#10B981" : p.id === currentPhase ? "#00D4FF" : "#334155", boxShadow: p.id === currentPhase ? "0 0 8px #00D4FF" : "none" }}>
                  {p.id < currentPhase ? "✓" : p.icon}
                </span>
                <span style={S.phaseLabel}>{p.label}</span>
                {p.id < 5 && <span style={{ ...S.phaseLine, background: p.id < currentPhase ? "#10B981" : "#334155" }} />}
              </div>
            ))}
          </div>
        </div>
        <div style={S.headerRight}>
          <div style={S.progressRing}>
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="22" fill="none" stroke="#1E293B" strokeWidth="4" />
              <circle cx="26" cy="26" r="22" fill="none" stroke="#00D4FF" strokeWidth="4" strokeDasharray={`${(totalProgress / 100) * 138.2} 138.2`} strokeLinecap="round" transform="rotate(-90 26 26)" style={{ transition: "stroke-dasharray 0.5s ease" }} />
            </svg>
            <span style={S.progressText}>{totalProgress}%</span>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={S.body}>
        {/* ── Left: Team Panel ── */}
        <aside style={S.leftPanel}>
          <div style={S.panelTitle}>
            <span>🤖</span> 当前团队
            <span style={S.teamCount}>{AGENTS.filter((a) => tasks.some((t) => t.agent === a.id)).length} 人</span>
          </div>
          {AGENTS.filter((a) => tasks.some((t) => t.agent === a.id)).map((agent) => {
            const st = agentStatus(agent.id);
            const currentTask = tasks.find((t) => t.agent === agent.id && t.status === "working");
            const isSelected = selectedAgent === agent.id;
            return (
              <div key={agent.id} onClick={() => setSelectedAgent(isSelected ? null : agent.id)} style={{ ...S.agentCard, borderColor: isSelected ? agent.color : "transparent", background: isSelected ? `${agent.color}10` : "#0F172A" }}>
                <div style={S.agentTop}>
                  <span style={{ ...S.agentAvatar, background: `${agent.color}20`, boxShadow: st === "working" ? `0 0 12px ${agent.color}40` : "none" }}>{agent.emoji}</span>
                  <div style={S.agentInfo}>
                    <div style={S.agentName}>
                      {agent.name}
                      {agent.id === "xiaece" && <span style={S.leaderBadge}>Leader</span>}
                    </div>
                    <div style={S.agentRole}>{agent.role}</div>
                  </div>
                  <span style={{ ...S.statusDot, background: statusColor(st) }}>
                    {st === "working" && <span style={S.statusPulse} />}
                  </span>
                </div>
                {currentTask && (
                  <div style={S.agentTask}>
                    <div style={S.agentTaskLabel}>当前任务</div>
                    <div style={S.agentTaskName}>{currentTask.title}</div>
                    <div style={S.miniProgress}>
                      <div style={{ ...S.miniProgressBar, width: `${currentTask.progress}%`, background: agent.color }} />
                    </div>
                  </div>
                )}
                {st === "done" && <div style={S.agentDone}>✓ 全部任务已完成</div>}
                {st === "idle" && <div style={S.agentIdle}>待命中</div>}
              </div>
            );
          })}
        </aside>

        {/* ── Center: Main Area ── */}
        <main style={S.mainArea}>
          {/* Tabs */}
          <div style={S.tabs}>
            <button onClick={() => setActiveTab("board")} style={{ ...S.tab, ...(activeTab === "board" ? S.tabActive : {}) }}>
              📋 任务看板
            </button>
            <button onClick={() => setActiveTab("messages")} style={{ ...S.tab, ...(activeTab === "messages" ? S.tabActive : {}) }}>
              💬 协作消息
              {messages.length > 0 && <span style={S.msgBadge}>{messages.length}</span>}
            </button>
          </div>

          {activeTab === "board" ? (
            /* ── Task Board ── */
            <div style={S.board}>
              {/* Dependency Flow View */}
              <div style={S.flowContainer}>
                {tasks.map((task, i) => {
                  const agent = getAgent(task.agent);
                  const isSelected = selectedTask === task.id;
                  return (
                    <div key={task.id} onClick={() => setSelectedTask(isSelected ? null : task.id)} style={{ ...S.taskCard, borderColor: task.status === "working" ? agent.color : task.status === "done" ? "#10B981" : "#1E293B", boxShadow: task.status === "working" ? `0 0 20px ${agent.color}15` : isSelected ? `0 0 20px ${agent.color}25` : "none", opacity: task.status === "locked" ? 0.5 : 1 }}>
                      <div style={S.taskHeader}>
                        <span style={{ ...S.taskStatus, background: `${statusColor(task.status)}18`, color: statusColor(task.status) }}>{statusLabel(task.status)}</span>
                        {task.deps.length > 0 && <span style={S.taskDeps}>← {task.deps.map((d) => tasks.find((t) => t.id === d)?.title.slice(0, 4)).join(", ")}</span>}
                      </div>
                      <div style={S.taskTitle}>{task.title}</div>
                      <div style={S.taskMeta}>
                        <span style={{ ...S.taskAgent, background: `${agent.color}15`, color: agent.color }}>
                          {agent.emoji} {agent.name}
                        </span>
                        <span style={S.taskPhase}>Phase {task.phase}</span>
                      </div>
                      {(task.status === "working" || task.status === "done") && (
                        <div style={S.taskProgressWrap}>
                          <div style={S.taskProgressBg}>
                            <div style={{ ...S.taskProgressFill, width: `${task.progress}%`, background: task.status === "done" ? "#10B981" : agent.color }} />
                          </div>
                          <span style={S.taskProgressNum}>{task.progress}%</span>
                        </div>
                      )}
                      {isSelected && task.output && (
                        <div style={S.taskOutput}>
                          <div style={S.taskOutputLabel}>产出物</div>
                          <div style={S.taskOutputText}>{task.output}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div style={S.legend}>
                {[["已完成", "#10B981"], ["执行中", "#00D4FF"], ["等待中", "#F59E0B"], ["未解锁", "#64748B"]].map(([l, c]) => (
                  <span key={l} style={S.legendItem}>
                    <span style={{ ...S.legendDot, background: c }} />
                    {l}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            /* ── Message Stream ── */
            <div style={S.messageStream}>
              {messages.length === 0 && <div style={S.emptyMsg}>等待智能体开始通信...</div>}
              {messages.map((msg, i) => {
                const fromAgent = getAgent(msg.from);
                const toAgent = msg.to === "all" ? null : getAgent(msg.to);
                return (
                  <div key={i} style={{ ...S.msgItem, animation: "slideIn 0.3s ease-out", borderLeft: `3px solid ${fromAgent.color}` }}>
                    <div style={S.msgHeader}>
                      <span style={{ ...S.msgFrom, color: fromAgent.color }}>
                        {fromAgent.emoji} {fromAgent.name}
                      </span>
                      <span style={S.msgArrow}>→</span>
                      <span style={S.msgTo}>{msg.to === "all" ? "📢 全体" : `${toAgent.emoji} ${toAgent.name}`}</span>
                      <span style={S.msgTime}>{msg.ts}</span>
                    </div>
                    <div style={S.msgText}>{msg.text}</div>
                  </div>
                );
              })}
              <div ref={msgEndRef} />
            </div>
          )}
        </main>

        {/* ── Right: Activity Feed ── */}
        <aside style={S.rightPanel}>
          <div style={S.panelTitle}>📡 实时动态</div>
          <div style={S.activityFeed}>
            {messages.slice(-8).reverse().map((msg, i) => {
              const agent = getAgent(msg.from);
              return (
                <div key={i} style={S.activityItem}>
                  <span style={{ ...S.activityDot, background: agent.color }} />
                  <div style={S.activityContent}>
                    <span style={{ ...S.activityAgent, color: agent.color }}>{agent.name}</span>
                    <span style={S.activityText}>{msg.text.length > 30 ? msg.text.slice(0, 30) + "..." : msg.text}</span>
                    <span style={S.activityTime}>{msg.ts}</span>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && <div style={S.emptyMsg}>等待中...</div>}
          </div>

          <div style={{ ...S.panelTitle, marginTop: 24 }}>📊 任务统计</div>
          <div style={S.statsGrid}>
            {[
              { label: "总任务", value: tasks.length, color: "#94A3B8" },
              { label: "已完成", value: tasks.filter((t) => t.status === "done").length, color: "#10B981" },
              { label: "进行中", value: tasks.filter((t) => t.status === "working").length, color: "#00D4FF" },
              { label: "等待中", value: tasks.filter((t) => t.status === "waiting" || t.status === "locked").length, color: "#F59E0B" },
            ].map((s) => (
              <div key={s.label} style={S.statCard}>
                <div style={{ ...S.statValue, color: s.color }}>{s.value}</div>
                <div style={S.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ ...S.panelTitle, marginTop: 24 }}>🎯 场景信息</div>
          <div style={S.scenarioInfo}>
            <div style={S.scenarioRow}><span style={S.scenarioLabel}>场景模板</span><span>深度报道</span></div>
            <div style={S.scenarioRow}><span style={S.scenarioLabel}>创建时间</span><span>{new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span></div>
            <div style={S.scenarioRow}><span style={S.scenarioLabel}>预计耗时</span><span>~8 分钟</span></div>
            <div style={S.scenarioRow}><span style={S.scenarioLabel}>当前阶段</span><span style={{ color: "#00D4FF" }}>并行执行</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  @keyframes pulse { 0%,100%{transform:scale(1);opacity:.3} 50%{transform:scale(2.2);opacity:0} }
  @keyframes slideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes glow { 0%,100%{box-shadow:0 0 8px rgba(0,212,255,.15)} 50%{box-shadow:0 0 20px rgba(0,212,255,.3)} }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #1E293B; border-radius: 3px; }
`;

const font = "'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif";
const mono = "'JetBrains Mono', monospace";

const S = {
  root: { fontFamily: font, background: "#070B14", color: "#E2E8F0", minHeight: "100vh", display: "flex", flexDirection: "column", fontSize: 13 },

  // Header
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", background: "#0B1120", borderBottom: "1px solid #1E293B", gap: 16, flexShrink: 0 },
  headerLeft: { flex: "0 0 auto" },
  headerCenter: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  headerRight: { flex: "0 0 auto" },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoIcon: { width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #00D4FF, #0066FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff" },
  logoTitle: { fontSize: 14, fontWeight: 600, letterSpacing: 0.5 },
  logoSub: { fontSize: 10, color: "#64748B", fontFamily: mono, letterSpacing: 1 },
  missionName: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#F1F5F9" },
  phaseBar: { display: "flex", alignItems: "center", gap: 0 },
  phaseItem: { display: "flex", alignItems: "center", gap: 4, transition: "opacity .3s" },
  phaseDot: { width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, color: "#F1F5F9", flexShrink: 0 },
  phaseLabel: { fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap" },
  phaseLine: { width: 28, height: 2, borderRadius: 1, margin: "0 4px" },
  progressRing: { position: "relative", width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center" },
  progressText: { position: "absolute", fontSize: 12, fontWeight: 600, fontFamily: mono, color: "#00D4FF" },

  // Body
  body: { display: "flex", flex: 1, overflow: "hidden", minHeight: 0 },

  // Left Panel
  leftPanel: { width: 240, borderRight: "1px solid #1E293B", background: "#0B1120", padding: "16px 12px", overflowY: "auto", flexShrink: 0 },
  panelTitle: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  teamCount: { marginLeft: "auto", fontSize: 11, color: "#475569", fontFamily: mono },
  agentCard: { padding: 12, borderRadius: 10, border: "1px solid transparent", marginBottom: 8, cursor: "pointer", transition: "all .2s" },
  agentTop: { display: "flex", alignItems: "center", gap: 8 },
  agentAvatar: { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, transition: "box-shadow .3s" },
  agentInfo: { flex: 1, minWidth: 0 },
  agentName: { fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 },
  agentRole: { fontSize: 11, color: "#64748B", marginTop: 1 },
  leaderBadge: { fontSize: 9, fontWeight: 700, fontFamily: mono, color: "#FF6B35", background: "#FF6B3518", padding: "1px 5px", borderRadius: 3, letterSpacing: 0.5 },
  statusDot: { width: 8, height: 8, borderRadius: "50%", position: "relative", flexShrink: 0 },
  statusPulse: { position: "absolute", inset: -3, borderRadius: "50%", border: "1px solid currentColor", opacity: 0.4, animation: "pulse 2s infinite" },
  agentTask: { marginTop: 8, paddingTop: 8, borderTop: "1px solid #1E293B" },
  agentTaskLabel: { fontSize: 10, color: "#475569", marginBottom: 3 },
  agentTaskName: { fontSize: 11, color: "#CBD5E1", fontWeight: 500 },
  miniProgress: { height: 3, borderRadius: 2, background: "#1E293B", marginTop: 6, overflow: "hidden" },
  miniProgressBar: { height: "100%", borderRadius: 2, transition: "width .5s ease" },
  agentDone: { marginTop: 8, fontSize: 11, color: "#10B981" },
  agentIdle: { marginTop: 8, fontSize: 11, color: "#475569" },

  // Main Area
  mainArea: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  tabs: { display: "flex", gap: 0, borderBottom: "1px solid #1E293B", background: "#0B1120", flexShrink: 0 },
  tab: { padding: "10px 20px", fontSize: 13, fontWeight: 500, color: "#64748B", background: "none", border: "none", borderBottom: "2px solid transparent", cursor: "pointer", fontFamily: font, display: "flex", alignItems: "center", gap: 6, transition: "all .2s", position: "relative" },
  tabActive: { color: "#F1F5F9", borderBottomColor: "#00D4FF" },
  msgBadge: { fontSize: 10, fontWeight: 600, fontFamily: mono, background: "#00D4FF", color: "#070B14", borderRadius: 8, padding: "1px 6px", minWidth: 18, textAlign: "center" },

  // Board
  board: { flex: 1, padding: 16, overflowY: "auto" },
  flowContainer: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 },
  taskCard: { padding: 14, borderRadius: 12, background: "#0F172A", border: "1px solid #1E293B", cursor: "pointer", transition: "all .25s" },
  taskHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  taskStatus: { fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, fontFamily: mono },
  taskDeps: { fontSize: 10, color: "#475569" },
  taskTitle: { fontSize: 14, fontWeight: 600, color: "#F1F5F9", marginBottom: 10 },
  taskMeta: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  taskAgent: { fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 4 },
  taskPhase: { fontSize: 10, color: "#475569", fontFamily: mono },
  taskProgressWrap: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 },
  taskProgressBg: { flex: 1, height: 4, borderRadius: 2, background: "#1E293B", overflow: "hidden" },
  taskProgressFill: { height: "100%", borderRadius: 2, transition: "width .5s ease" },
  taskProgressNum: { fontSize: 11, fontFamily: mono, color: "#94A3B8", minWidth: 32, textAlign: "right" },
  taskOutput: { marginTop: 10, padding: 10, background: "#070B14", borderRadius: 8, animation: "slideIn .3s ease" },
  taskOutputLabel: { fontSize: 10, color: "#475569", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 },
  taskOutputText: { fontSize: 12, color: "#CBD5E1", lineHeight: 1.6 },
  legend: { display: "flex", gap: 16, marginTop: 16, justifyContent: "center" },
  legendItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748B" },
  legendDot: { width: 8, height: 8, borderRadius: "50%" },

  // Messages
  messageStream: { flex: 1, padding: 16, overflowY: "auto" },
  emptyMsg: { color: "#475569", textAlign: "center", padding: 40, fontSize: 13 },
  msgItem: { padding: 12, marginBottom: 8, borderRadius: 8, background: "#0F172A" },
  msgHeader: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" },
  msgFrom: { fontSize: 12, fontWeight: 600 },
  msgArrow: { fontSize: 10, color: "#475569" },
  msgTo: { fontSize: 12, color: "#94A3B8" },
  msgTime: { marginLeft: "auto", fontSize: 10, color: "#334155", fontFamily: mono },
  msgText: { fontSize: 13, color: "#CBD5E1", lineHeight: 1.6 },

  // Right Panel
  rightPanel: { width: 220, borderLeft: "1px solid #1E293B", background: "#0B1120", padding: "16px 12px", overflowY: "auto", flexShrink: 0 },
  activityFeed: { display: "flex", flexDirection: "column", gap: 8 },
  activityItem: { display: "flex", gap: 8 },
  activityDot: { width: 6, height: 6, borderRadius: "50%", marginTop: 6, flexShrink: 0 },
  activityContent: { display: "flex", flexDirection: "column", gap: 2 },
  activityAgent: { fontSize: 11, fontWeight: 600 },
  activityText: { fontSize: 11, color: "#64748B", lineHeight: 1.4 },
  activityTime: { fontSize: 10, color: "#334155", fontFamily: mono },
  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  statCard: { padding: 10, borderRadius: 8, background: "#0F172A", textAlign: "center" },
  statValue: { fontSize: 22, fontWeight: 700, fontFamily: mono },
  statLabel: { fontSize: 10, color: "#475569", marginTop: 2 },
  scenarioInfo: { display: "flex", flexDirection: "column", gap: 6 },
  scenarioRow: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#CBD5E1" },
  scenarioLabel: { color: "#475569" },
};
