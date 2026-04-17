import type { EmployeeId } from "@/lib/constants";

type AvatarProps = { className?: string };

function FaceBase({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <>
      <circle cx="32" cy="36" r="13" fill={fill} />
      <circle cx="32" cy="36" r="13" fill="none" stroke={stroke} strokeWidth="1.5" />
      <g className="avatar-eye">
        <circle cx="27" cy="36" r="1.7" fill="#1f2937" />
        <circle cx="27.4" cy="35.4" r="0.5" fill="#fff" />
      </g>
      <g className="avatar-eye avatar-eye-2">
        <circle cx="37" cy="36" r="1.7" fill="#1f2937" />
        <circle cx="37.4" cy="35.4" r="0.5" fill="#fff" />
      </g>
      <circle cx="25" cy="40" r="1.6" fill="#fca5a5" opacity="0.55" />
      <circle cx="39" cy="40" r="1.6" fill="#fca5a5" opacity="0.55" />
      <path fill="none" stroke="#1f2937" strokeWidth="1.3" strokeLinecap="round" d="M29 41.5 Q32 43.5 35 41.5">
        <animate
          attributeName="d"
          values="M29 41.5 Q32 43.5 35 41.5;M29 41.2 Q32 44.4 35 41.2;M29 41.5 Q32 43.5 35 41.5;M29 41.8 Q32 42.8 35 41.8;M29 41.5 Q32 43.5 35 41.5"
          dur="3.2s"
          repeatCount="indefinite"
        />
      </path>
    </>
  );
}

// ---- 小雷 · 热点分析师 — 雷达扫描风 ----
export function XiaoleiAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xl-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff7ed" />
          <stop offset="100%" stopColor="#fdba74" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xl-bg)" />
      {/* rotating scan beam */}
      <g className="avatar-anim-spin" style={{ transformOrigin: "32px 40px" }}>
        <path d="M32 40 L52 28 A22 22 0 0 0 32 18 Z" fill="#f59e0b" opacity="0.22" />
      </g>
      <path d="M12 40 A22 22 0 0 1 52 40" fill="none" stroke="#f59e0b" strokeWidth="1.3" opacity="0.28" />
      <path d="M18 40 A16 16 0 0 1 46 40" fill="none" stroke="#f59e0b" strokeWidth="1.3" opacity="0.42" />
      <path d="M22 28 Q32 20 42 28 L42 30 Q32 23 22 30 Z" fill="#f59e0b" />
      <line x1="32" y1="22" x2="32" y2="14" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      {/* blinking antenna tip */}
      <g className="avatar-anim-pulse" style={{ transformOrigin: "32px 12px" }}>
        <circle cx="32" cy="12" r="2.6" fill="#f59e0b" />
        <circle cx="32" cy="12" r="1" fill="#fffbeb" />
      </g>
      <FaceBase fill="#fff3e0" stroke="#f59e0b" />
    </svg>
  );
}

// ---- 小策 · 选题策划师 — 创意灯泡风 ----
export function XiaoceAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xc-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5f3ff" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
        <radialGradient id="xc-bulb" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#fde047" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xc-bg)" />
      {/* sparkles */}
      <g className="avatar-anim-shimmer">
        <path d="M10 14 l2 2 M54 10 l-2 2 M48 20 l2 -2" stroke="#a78bfa" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <g className="avatar-anim-shimmer avatar-delay-2">
        <circle cx="46" cy="16" r="1.5" fill="#fde047" />
        <circle cx="16" cy="22" r="1.2" fill="#a78bfa" />
      </g>
      {/* bulb glows */}
      <g className="avatar-anim-blink" style={{ transformOrigin: "32px 16px" }}>
        <ellipse cx="32" cy="16" rx="6.5" ry="7" fill="url(#xc-bulb)" />
      </g>
      <rect x="29" y="22" width="6" height="3" rx="1" fill="#8b5cf6" />
      <line x1="30.5" y1="26" x2="33.5" y2="26" stroke="#8b5cf6" strokeWidth="1.2" />
      <path d="M22 36 Q32 28 42 36" fill="#8b5cf6" />
      <FaceBase fill="#f5f3ff" stroke="#8b5cf6" />
    </svg>
  );
}

// ---- 小资 · 素材研究员 — 书页 + 圆框眼镜 ----
export function XiaoziAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xz-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ecfdf5" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xz-bg)" />
      {/* floating pages (opposite phases) */}
      <g className="avatar-anim-float" style={{ transformOrigin: "12px 22px" }}>
        <rect x="6" y="14" width="12" height="16" rx="2" fill="#fff" stroke="#10b981" strokeWidth="1.3" transform="rotate(-10 12 22)" />
        <line x1="8" y1="20" x2="16" y2="20" stroke="#10b981" strokeWidth="1" opacity="0.5" transform="rotate(-10 12 22)" />
        <line x1="8" y1="24" x2="14" y2="24" stroke="#10b981" strokeWidth="1" opacity="0.5" transform="rotate(-10 12 22)" />
      </g>
      <g className="avatar-anim-float avatar-delay-2" style={{ transformOrigin: "52px 20px" }}>
        <rect x="46" y="12" width="12" height="16" rx="2" fill="#fff" stroke="#10b981" strokeWidth="1.3" transform="rotate(12 52 20)" />
      </g>
      <path d="M22 28 Q32 22 42 28" fill="#10b981" />
      <FaceBase fill="#ecfdf5" stroke="#10b981" />
      <circle cx="27" cy="36" r="3.5" fill="none" stroke="#1f2937" strokeWidth="1.3" />
      <circle cx="37" cy="36" r="3.5" fill="none" stroke="#1f2937" strokeWidth="1.3" />
      <line x1="30.5" y1="36" x2="33.5" y2="36" stroke="#1f2937" strokeWidth="1.3" />
    </svg>
  );
}

// ---- 小文 · 内容创作师 — 钢笔 + 墨水波浪 ----
export function XiaowenAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xw-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eff6ff" />
          <stop offset="100%" stopColor="#93c5fd" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xw-bg)" />
      {/* ink wave */}
      <g className="avatar-anim-scan-x">
        <path d="M8 52 Q16 48 24 52 T40 52 T56 52" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
        <path d="M8 56 Q16 52 24 56 T40 56 T56 56" fill="none" stroke="#3b82f6" strokeWidth="1.2" opacity="0.32" strokeLinecap="round" />
      </g>
      {/* swaying pen */}
      <g className="avatar-anim-sway" style={{ transformOrigin: "32px 24px" }}>
        <path d="M18 26 L26 18 L46 38 L38 46 Z" fill="#3b82f6" transform="translate(6 -8)" />
        <path d="M18 26 L26 18 L30 22 L22 30 Z" fill="#1e40af" transform="translate(6 -8)" />
        <circle cx="47" cy="13" r="2" fill="#3b82f6" />
      </g>
      <path d="M22 30 Q32 24 42 30" fill="#3b82f6" opacity="0.9" />
      <FaceBase fill="#eff6ff" stroke="#3b82f6" />
    </svg>
  );
}

// ---- 小见 · 视频制片人 — 导演帽 + 胶片孔 ----
export function XiaojianAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xj-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fef2f2" />
          <stop offset="100%" stopColor="#fca5a5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xj-bg)" />
      {/* film strip sides with blinking perforations */}
      <rect x="6" y="10" width="6" height="10" rx="1" fill="#1f2937" />
      <rect x="52" y="10" width="6" height="10" rx="1" fill="#1f2937" />
      <g className="avatar-anim-blink">
        <circle cx="9" cy="13" r="1" fill="#fef2f2" />
        <circle cx="55" cy="17" r="1" fill="#fef2f2" />
      </g>
      <g className="avatar-anim-blink avatar-delay-2">
        <circle cx="9" cy="17" r="1" fill="#fef2f2" />
        <circle cx="55" cy="13" r="1" fill="#fef2f2" />
      </g>
      <path d="M18 30 Q32 18 46 30 L44 32 Q32 22 20 32 Z" fill="#1f2937" />
      <rect x="18" y="30" width="28" height="3" fill="#1f2937" />
      {/* pulsing red record dot */}
      <g className="avatar-anim-pulse" style={{ transformOrigin: "40px 23px" }}>
        <circle cx="40" cy="23" r="2.2" fill="#ef4444" />
      </g>
      <FaceBase fill="#fef2f2" stroke="#ef4444" />
    </svg>
  );
}

// ---- 小审 · 质量审核官 — 放大镜 + 勾选 ----
export function XiaoshenAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xs-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eef2ff" />
          <stop offset="100%" stopColor="#a5b4fc" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xs-bg)" />
      <path d="M22 28 Q32 22 42 28" fill="#6366f1" />
      <path d="M20 28 L44 28" stroke="#4338ca" strokeWidth="1" opacity="0.6" />
      <FaceBase fill="#eef2ff" stroke="#6366f1" />
      {/* magnifier glass scanning */}
      <g className="avatar-anim-scan-x" style={{ transformOrigin: "50px 16px" }}>
        <circle cx="48" cy="14" r="7" fill="none" stroke="#6366f1" strokeWidth="2.2" />
        <circle cx="48" cy="14" r="5" fill="#fff" opacity="0.85" />
        <path d="M45 14 l2 2 l4 -4" fill="none" stroke="#10b981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="53" y1="19" x2="58" y2="24" stroke="#6366f1" strokeWidth="2.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ---- 小发 · 渠道运营师 — 耳机 + 广播波 ----
export function XiaofaAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xf-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0fdfa" />
          <stop offset="100%" stopColor="#5eead4" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xf-bg)" />
      {/* left waves pulsing outward */}
      <g className="avatar-anim-wave" style={{ transformOrigin: "10px 38px" }}>
        <path d="M6 36 Q10 32 14 36" fill="none" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4 40 Q10 34 16 40" fill="none" stroke="#14b8a6" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
      </g>
      <g className="avatar-anim-wave avatar-delay-2" style={{ transformOrigin: "54px 38px" }}>
        <path d="M50 36 Q54 32 58 36" fill="none" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M48 40 Q54 34 60 40" fill="none" stroke="#14b8a6" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
      </g>
      <FaceBase fill="#f0fdfa" stroke="#14b8a6" />
      <path d="M18 34 Q18 22 32 22 Q46 22 46 34" fill="none" stroke="#0f766e" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="15" y="32" width="6" height="9" rx="2" fill="#14b8a6" />
      <rect x="43" y="32" width="6" height="9" rx="2" fill="#14b8a6" />
    </svg>
  );
}

// ---- 小数 · 数据分析师 — 柱状图 + 趋势线 ----
export function XiaoshuAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xsh-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff7ed" />
          <stop offset="100%" stopColor="#fdba74" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xsh-bg)" />
      {/* bouncing top bars (staggered) */}
      <g className="avatar-anim-bounce" style={{ transformOrigin: "8px 24px" }}>
        <rect x="6" y="16" width="4" height="8" rx="1" fill="#f97316" opacity="0.85" />
      </g>
      <g className="avatar-anim-bounce avatar-delay-2" style={{ transformOrigin: "14px 24px" }}>
        <rect x="12" y="12" width="4" height="12" rx="1" fill="#f97316" />
      </g>
      <g className="avatar-anim-bounce avatar-delay-1" style={{ transformOrigin: "50px 24px" }}>
        <rect x="48" y="14" width="4" height="10" rx="1" fill="#f97316" />
      </g>
      <g className="avatar-anim-bounce avatar-delay-3" style={{ transformOrigin: "56px 24px" }}>
        <rect x="54" y="10" width="4" height="14" rx="1" fill="#f97316" />
      </g>
      <path d="M6 10 L14 8 L52 6 L58 4" fill="none" stroke="#ea580c" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
      {/* pulsing end point */}
      <g className="avatar-anim-pulse" style={{ transformOrigin: "58px 4px" }}>
        <circle cx="58" cy="4" r="1.8" fill="#ea580c" />
      </g>
      <path d="M22 30 Q32 24 42 30" fill="#f97316" />
      <FaceBase fill="#fff7ed" stroke="#f97316" />
      {/* bouncing bottom bars on cheek */}
      <g className="avatar-anim-bounce" style={{ transformOrigin: "25.5px 50px" }}>
        <rect x="24" y="46" width="3" height="4" rx="0.5" fill="#f97316" opacity="0.85" />
      </g>
      <g className="avatar-anim-bounce avatar-delay-2" style={{ transformOrigin: "30.5px 50px" }}>
        <rect x="29" y="44" width="3" height="6" rx="0.5" fill="#f97316" />
      </g>
      <g className="avatar-anim-bounce avatar-delay-3" style={{ transformOrigin: "35.5px 50px" }}>
        <rect x="34" y="42" width="3" height="8" rx="0.5" fill="#ea580c" />
      </g>
    </svg>
  );
}

// ---- 小探 · 深度调查员 — 侦探帽 + 放大镜 ----
export function XiaotanAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xt-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0f9ff" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xt-bg)" />
      {/* footsteps clues */}
      <g className="avatar-anim-shimmer">
        <circle cx="10" cy="52" r="1.2" fill="#0ea5e9" />
        <circle cx="16" cy="56" r="1.2" fill="#0ea5e9" />
      </g>
      <g className="avatar-anim-shimmer avatar-delay-2">
        <circle cx="22" cy="52" r="1.2" fill="#0ea5e9" />
      </g>
      {/* deerstalker hat */}
      <path d="M18 26 Q18 18 32 16 Q46 18 46 26 L46 30 L18 30 Z" fill="#0c4a6e" />
      <ellipse cx="32" cy="30" rx="16" ry="2.2" fill="#075985" />
      <path d="M20 22 Q26 16 32 16 L32 20 Z" fill="#0369a1" />
      <path d="M44 22 Q38 16 32 16 L32 20 Z" fill="#0369a1" />
      {/* top question spark */}
      <g className="avatar-anim-pulse" style={{ transformOrigin: "32px 10px" }}>
        <path d="M30 10 Q32 6 34 10 Q34 12 32 13 L32 14" fill="none" stroke="#0ea5e9" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="32" cy="16" r="0.8" fill="#0ea5e9" />
      </g>
      <FaceBase fill="#f0f9ff" stroke="#0ea5e9" />
      {/* scanning magnifier over one eye */}
      <g className="avatar-anim-scan-x" style={{ transformOrigin: "50px 38px" }}>
        <circle cx="50" cy="38" r="7" fill="none" stroke="#0c4a6e" strokeWidth="2" />
        <circle cx="50" cy="38" r="5" fill="#bae6fd" opacity="0.5" />
        <line x1="55" y1="43" x2="60" y2="48" stroke="#0c4a6e" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ---- 小领 · 任务总监 — 金冠 + 光环 ----
export function LeaderAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xl-lead-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff1f2" />
          <stop offset="100%" stopColor="#fda4af" />
        </linearGradient>
        <linearGradient id="xl-crown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xl-lead-bg)" />
      {/* rotating halo */}
      <g className="avatar-anim-spin" style={{ transformOrigin: "32px 36px" }}>
        <circle cx="32" cy="36" r="20" fill="none" stroke="#e11d48" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.35" />
      </g>
      {/* sparkles */}
      <g className="avatar-anim-shimmer">
        <path d="M12 18 l1.5 1.5 M52 16 l-1.5 1.5" stroke="#e11d48" strokeWidth="1.4" strokeLinecap="round" />
      </g>
      <g className="avatar-anim-shimmer avatar-delay-2">
        <circle cx="50" cy="24" r="1" fill="#fde047" />
        <circle cx="14" cy="24" r="1" fill="#fde047" />
      </g>
      {/* floating crown */}
      <g className="avatar-anim-float" style={{ transformOrigin: "32px 16px" }}>
        <path d="M20 20 L22 10 L28 16 L32 8 L36 16 L42 10 L44 20 Z" fill="url(#xl-crown)" stroke="#b45309" strokeWidth="1" strokeLinejoin="round" />
        <rect x="20" y="20" width="24" height="2.6" rx="0.6" fill="#b45309" />
        <circle cx="32" cy="8" r="1.4" fill="#fde047" />
        <circle cx="22" cy="10" r="1" fill="#fde047" />
        <circle cx="42" cy="10" r="1" fill="#fde047" />
      </g>
      <FaceBase fill="#fff1f2" stroke="#e11d48" />
      {/* leader sash / star */}
      <g className="avatar-anim-pulse" style={{ transformOrigin: "47px 49px" }}>
        <path d="M47 45 L48.5 48 L51.5 48.3 L49.3 50.5 L50 53.5 L47 52 L44 53.5 L44.7 50.5 L42.5 48.3 L45.5 48 Z" fill="#e11d48" />
      </g>
    </svg>
  );
}

export const EMPLOYEE_AVATAR_MAP: Partial<Record<EmployeeId, (props: AvatarProps) => React.JSX.Element>> = {
  xiaolei: XiaoleiAvatar,
  xiaoce: XiaoceAvatar,
  xiaozi: XiaoziAvatar,
  xiaowen: XiaowenAvatar,
  xiaojian: XiaojianAvatar,
  xiaoshen: XiaoshenAvatar,
  xiaofa: XiaofaAvatar,
  xiaoshu: XiaoshuAvatar,
  xiaotan: XiaotanAvatar,
  leader: LeaderAvatar,
};
