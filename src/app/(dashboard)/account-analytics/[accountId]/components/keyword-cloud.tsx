'use client'
import { useEffect, useRef, useState } from 'react'
import cloud from 'd3-cloud'
import { cn } from '@/lib/utils'
import { ZERO_STATE_PHASE1, zeroStatePhase2 } from '@/lib/account-analytics/content-category'
import type { CloudRange } from './use-url-state'

interface LayoutWord {
  text: string
  size: number
  x?: number
  y?: number
  rotate?: number
}

interface Props {
  range: CloudRange
  onRangeChange: (r: CloudRange) => void
  loader: (r: CloudRange) => Promise<{
    words: Array<{ keyword: string; weight: number }>
    annotatedRatio: number
  }>
}

const COLOR_PALETTE = [
  '#2E75B6', '#7CB9E8', '#0EA5E9', '#00B5A8', '#9B59B6',
  '#3498DB', '#16A085', '#1F3864', '#34495E', '#5B8DEF',
]

export function KeywordCloud({ range, onRangeChange, loader }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<LayoutWord[]>([])
  const [annotatedRatio, setAnnotatedRatio] = useState(0)
  const [loading, setLoading] = useState(true)
  const reqIdRef = useRef(0)

  useEffect(() => {
    const id = ++reqIdRef.current
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag must flip synchronously when range changes
    setLoading(true)
    loader(range).then((d) => {
      if (id !== reqIdRef.current) return
      setAnnotatedRatio(d.annotatedRatio)
      if (d.annotatedRatio < 0.7 || d.words.length === 0) {
        setLayout([])
        setLoading(false)
        return
      }
      const width = containerRef.current?.clientWidth ?? 400
      const height = 240
      const maxWeight = Math.max(...d.words.map((w) => w.weight))
      cloud<LayoutWord>()
        .size([width, height])
        .words(
          d.words.map((w) => ({
            text: w.keyword,
            size: 12 + (w.weight / maxWeight) * 32,
          })),
        )
        .padding(4)
        .rotate(0)
        .font('Inter, system-ui, sans-serif')
        .fontSize((wd) => wd.size)
        .on('end', (rendered) => {
          if (id !== reqIdRef.current) return // 防 race：迟到回调直接丢弃
          setLayout(rendered)
          setLoading(false)
        })
        .start()
    })
  }, [range, loader])

  return (
    <div ref={containerRef}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold text-[#1F3864] dark:text-blue-200">
          热门词云
        </h3>
        <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-0.5">
          {(['7d', '30d'] as const).map((r) => (
            // eslint-disable-next-line no-restricted-syntax
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-medium border-0 cursor-pointer transition-colors',
                range === r ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500',
              )}
            >
              {r === '7d' ? '近一周' : '近一月'}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[240px] flex items-center justify-center">
        {loading ? (
          <span className="text-sm text-gray-400">加载中...</span>
        ) : annotatedRatio < 0.7 ? (
          <span className="text-sm text-gray-400 text-center px-4">
            {annotatedRatio === 0 ? ZERO_STATE_PHASE1 : zeroStatePhase2(annotatedRatio)}
          </span>
        ) : layout.length === 0 ? (
          <span className="text-sm text-gray-400">暂无关键词</span>
        ) : (
          <svg width="100%" height="240" viewBox="-200 -120 400 240">
            {layout.map((w, idx) => (
              <text
                key={`${w.text}-${idx}`}
                textAnchor="middle"
                transform={`translate(${w.x ?? 0},${w.y ?? 0})`}
                fontSize={w.size}
                fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                style={{ fontWeight: 600 }}
              >
                {w.text}
              </text>
            ))}
          </svg>
        )}
      </div>
    </div>
  )
}
