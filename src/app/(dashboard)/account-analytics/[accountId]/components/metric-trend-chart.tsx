'use client'
import { useEffect, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MetricPillButton } from './metric-pill-button'
import {
  METRIC_KEYS,
  METRIC_LABELS,
  GRANULARITY_LABELS,
  type MetricKey,
  type Granularity,
} from '@/lib/account-analytics/platform-meta'

interface Props {
  platform: string
  availability: Record<MetricKey, boolean>
  granularity: Granularity
  metric: MetricKey
  onMetricChange: (m: MetricKey) => void
  loader: (m: MetricKey, g: Granularity) => Promise<Array<{ bucket: string; value: number }>>
}

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

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-3 space-y-2">
        {visibleMetrics.map((m) => (
          <MetricPillButton
            key={m}
            label={METRIC_LABELS[m]}
            active={metric === m}
            onClick={() => onMetricChange(m)}
          />
        ))}
      </div>
      <div className="col-span-9">
        <div className="flex items-center justify-between mb-2 px-1">
          <h4 className="text-[14px] font-semibold text-[#1F3864]">数据表现 · {METRIC_LABELS[metric]}</h4>
          <span className="text-[11px] text-gray-500">{GRANULARITY_LABELS[granularity]}</span>
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
              <Area type="monotone" dataKey="value" stroke="#2E75B6" fill="url(#metric-gradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
