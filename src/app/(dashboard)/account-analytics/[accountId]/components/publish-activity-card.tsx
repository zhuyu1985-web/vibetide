'use client'
import { useEffect, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  type Granularity,
  type SummaryKey,
  SUMMARY_LABELS,
} from '@/lib/account-analytics/platform-meta'

interface Props {
  granularity: Granularity
  summaryKeys: SummaryKey[]
  loader: (g: Granularity) => Promise<{
    buckets: Array<{ bucket: string; publishCount: number }>
    summary: Partial<Record<SummaryKey, number>>
  }>
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

  return (
    <div className="space-y-4">
      <div className="h-[200px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400">加载中...</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.buckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickFormatter={(s) => s.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="publishCount" fill="#7CB9E8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {summaryKeys.map((k) => (
          <div key={k} className="rounded-xl bg-white/60 dark:bg-gray-900/40 p-3 text-center">
            <div className="text-[18px] font-semibold text-[#1F3864] dark:text-blue-200 tabular-nums">
              {(data.summary[k] ?? 0).toLocaleString('zh-CN')}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">{SUMMARY_LABELS[k]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
