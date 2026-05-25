'use client'
import { useEffect, useRef, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  type Granularity,
  type SummaryKey,
  SUMMARY_LABELS,
  GRANULARITY_LABELS,
} from '@/lib/account-analytics/platform-meta'

interface Props {
  granularity: Granularity
  summaryKeys: SummaryKey[]
  loader: (g: Granularity) => Promise<{
    buckets: Array<{ bucket: string; publishCount: number }>
    summary: Partial<Record<SummaryKey, number>>
  }>
}

const GRANULARITY_BUCKET_LABELS: Record<Granularity, string> = {
  day: '每日',
  week: '每周',
  month: '每月',
}

export function PublishActivityCard({ granularity, summaryKeys, loader }: Props) {
  const [data, setData] = useState<{
    buckets: Array<{ bucket: string; publishCount: number }>
    summary: Partial<Record<SummaryKey, number>>
  }>({ buckets: [], summary: {} })
  const [loading, setLoading] = useState(true)
  const reqIdRef = useRef(0)

  useEffect(() => {
    const id = ++reqIdRef.current
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag must flip synchronously when granularity changes
    setLoading(true)
    loader(granularity).then((d) => {
      if (id !== reqIdRef.current) return
      setData(d)
      setLoading(false)
    })
  }, [granularity, loader])

  const bucketLabel = GRANULARITY_BUCKET_LABELS[granularity]
  const windowLabel = GRANULARITY_LABELS[granularity]

  return (
    <div className="space-y-4">
      <div>
        {/* 图表标题 —— 明确指出柱子表达的维度,避免"不知道是哪个指标"困惑 */}
        <div className="flex items-center justify-between mb-2 px-1">
          <h4 className="text-[14px] font-semibold text-[#1F3864] dark:text-blue-200 flex items-center gap-1.5">
            <BarChart3 size={14} className="text-[#2E75B6]" />
            发布活跃度 · {bucketLabel}发布数
          </h4>
          <span className="text-[11px] text-gray-500">{windowLabel}</span>
        </div>
        <div className="h-[200px]">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">加载中...</div>
          ) : data.buckets.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">暂无数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.buckets} barCategoryGap="35%">
                <defs>
                  <linearGradient id="publish-bar-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5BA4D8" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#2E75B6" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickFormatter={(s) => s.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(46,117,182,0.06)' }}
                  formatter={(v) => [Number(v ?? 0).toLocaleString('zh-CN') + ' 条', '发布数']}
                  labelFormatter={(label) => `${bucketLabel} ${label ?? ''}`}
                />
                <Bar
                  name="发布数"
                  dataKey="publishCount"
                  fill="url(#publish-bar-gradient)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 6 列数字带 —— 每张 card 标注指标名,避免歧义 */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
          {windowLabel}汇总指标
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {summaryKeys.map((k) => (
            <div
              key={k}
              className="rounded-xl bg-gradient-to-br from-white to-[#F5F9FF] dark:from-gray-900/60 dark:to-blue-950/30 p-3 text-center border border-[#E5EEF7] dark:border-blue-900/30"
            >
              <div className="text-[18px] font-semibold text-[#1F3864] dark:text-blue-200 tabular-nums">
                {(data.summary[k] ?? 0).toLocaleString('zh-CN')}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">{SUMMARY_LABELS[k]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
