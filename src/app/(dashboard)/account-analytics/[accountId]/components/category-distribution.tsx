'use client'
import { useEffect, useRef, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AIGC_CATEGORY_COLORS,
  type AigcContentCategory,
  ZERO_STATE_PHASE1,
  zeroStatePhase2,
} from '@/lib/account-analytics/content-category'

interface Props {
  loader: () => Promise<{
    buckets: Array<{ category: AigcContentCategory; count: number }>
    annotatedRatio: number
  }>
}

export function CategoryDistribution({ loader }: Props) {
  const [data, setData] = useState<{
    buckets: Array<{ category: AigcContentCategory; count: number }>
    annotatedRatio: number
  }>({ buckets: [], annotatedRatio: 0 })
  const [loading, setLoading] = useState(true)
  const reqIdRef = useRef(0)

  useEffect(() => {
    const id = ++reqIdRef.current
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag must flip synchronously when loader changes
    setLoading(true)
    loader().then((d) => {
      if (id !== reqIdRef.current) return
      setData(d)
      setLoading(false)
    })
  }, [loader])

  if (loading) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-gray-400">
        加载中...
      </div>
    )
  }

  if (data.annotatedRatio < 0.7) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-gray-400 text-center px-4">
        {data.annotatedRatio === 0 ? ZERO_STATE_PHASE1 : zeroStatePhase2(data.annotatedRatio)}
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-[15px] font-semibold text-[#1F3864] dark:text-blue-200 mb-3">
        发文类型占比
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data.buckets} layout="vertical" margin={{ left: 30 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={60} />
          <Tooltip />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.buckets.map((entry) => (
              <Cell key={entry.category} fill={AIGC_CATEGORY_COLORS[entry.category]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
