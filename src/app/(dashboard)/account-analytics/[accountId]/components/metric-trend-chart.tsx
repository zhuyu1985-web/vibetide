'use client'
import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import {
  METRIC_KEYS,
  METRIC_LABELS,
  GRANULARITY_LABELS,
  type MetricKey,
  type Granularity,
} from '@/lib/account-analytics/platform-meta'
import { cn } from '@/lib/utils'

interface Props {
  platform: string
  availability: Record<MetricKey, boolean>
  granularity: Granularity
  metric: MetricKey
  onMetricChange: (m: MetricKey) => void
  loader: (m: MetricKey, g: Granularity) => Promise<Array<{ bucket: string; value: number }>>
}

const COMPOSITE_SCORE_FORMULA = '点赞 × 1 + 评论 × 5 + 转发 × 5 + 收藏 × 2'

export function MetricTrendChart({ availability, granularity, metric, onMetricChange, loader }: Props) {
  const [data, setData] = useState<Array<{ bucket: string; value: number }>>([])
  const [loading, setLoading] = useState(true)
  const reqIdRef = useRef(0)

  useEffect(() => {
    const id = ++reqIdRef.current
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag must flip synchronously when metric/granularity changes
    setLoading(true)
    loader(metric, granularity).then((d) => {
      if (id !== reqIdRef.current) return
      setData(d)
      setLoading(false)
    })
  }, [metric, granularity, loader])

  const visibleMetrics = METRIC_KEYS.filter((m) => availability[m])
  const isCompositeScore = metric === 'compositeScore'

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* 左侧 metric 切换 —— 自定义按钮列表,选中态淡蓝填充 + 左侧蓝条 + 蓝色文字 */}
      <div className="col-span-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
          指标
        </div>
        <div role="tablist" aria-orientation="vertical" className="flex flex-col gap-1">
          {visibleMetrics.map((m) => {
            const active = m === metric
            return (
              <Button
                key={m}
                variant="ghost"
                size="sm"
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => onMetricChange(m)}
                className={cn(
                  'w-full justify-start text-[13px] rounded-lg transition-all',
                  active
                    ? 'bg-[#EEF4FB] dark:bg-blue-950/40 text-[#1F3864] dark:text-blue-200 font-semibold shadow-[inset_3px_0_0_#2E75B6] hover:bg-[#EEF4FB] dark:hover:bg-blue-950/40'
                    : 'text-gray-600 dark:text-gray-400 hover:text-[#1F3864] dark:hover:text-blue-200',
                )}
              >
                {METRIC_LABELS[m]}
              </Button>
            )
          })}
        </div>
      </div>

      {/* 右侧图表区 */}
      <div className="col-span-9">
        <div className="flex items-start justify-between gap-3 mb-2 px-1">
          <div className="min-w-0">
            <h4 className="text-[14px] font-semibold text-[#1F3864] dark:text-blue-200 flex items-center gap-1.5">
              数据表现 · {METRIC_LABELS[metric]}
              <span
                className="inline-flex items-center"
                title={`综合得分公式:${COMPOSITE_SCORE_FORMULA}\n播放数权重 0 — 部分平台不公开播放量,统一不计入`}
              >
                <Info size={13} className="text-[#2E75B6] cursor-help" />
              </span>
            </h4>
            {/* 综合得分公式常驻显示 —— 让用户在任意 metric 下都能看到打分逻辑 */}
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
              {isCompositeScore ? "当前指标公式:" : "综合得分公式:"}
              <span className="ml-1 inline-flex items-center rounded-md bg-[#EEF4FB] dark:bg-blue-950/40 px-2 py-0.5 text-[#1F3864] dark:text-blue-200 font-medium tabular-nums">
                {COMPOSITE_SCORE_FORMULA}
              </span>
              <span className="ml-2 text-gray-400">· 播放数权重 0(部分平台不公开)</span>
            </p>
          </div>
          <span className="shrink-0 text-[11px] text-gray-500 whitespace-nowrap pt-0.5">{GRANULARITY_LABELS[granularity]}</span>
        </div>
        {loading ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-gray-400">加载中...</div>
        ) : data.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-gray-400">暂无数据</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="metric-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2E75B6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#2E75B6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickFormatter={(s) => s.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number | undefined) => (v ?? 0).toLocaleString('zh-CN')} />
              <Area type="monotone" dataKey="value" stroke="#2E75B6" fill="url(#metric-gradient)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
