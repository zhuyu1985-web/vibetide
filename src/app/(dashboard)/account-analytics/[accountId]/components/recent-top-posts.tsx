'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Eye, MessageCircle, Calendar, Flame } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { TopSort } from './use-url-state'

interface Post {
  id: string
  title: string
  summary: string | null
  thumbnail: string | null
  score: number
  viewCount: number
  commentCount: number
  publishedAt: string
  sourceUrl: string
}

interface Props {
  mode: TopSort
  onModeChange: (m: TopSort) => void
  loader: (m: TopSort) => Promise<Post[]>
}

export function RecentTopPosts({ mode, onModeChange, loader }: Props) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const reqIdRef = useRef(0)

  useEffect(() => {
    const id = ++reqIdRef.current
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag must flip synchronously when mode changes
    setLoading(true)
    loader(mode).then((d) => {
      if (id !== reqIdRef.current) return
      setPosts(d)
      setLoading(false)
    })
  }, [mode, loader])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold text-[#1F3864] dark:text-blue-200">
          近期文章 TOP5
        </h3>
        <Tabs value={mode} onValueChange={(v) => onModeChange(v as TopSort)}>
          <TabsList variant="default">
            <TabsTrigger value="hot">最热</TabsTrigger>
            <TabsTrigger value="latest">最新</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">加载中...</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">近 30 天暂无发布</p>
      ) : (
        <div className="space-y-2.5">
          {posts.map((p, idx) => (
            <a
              key={p.id}
              href={p.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 p-3 rounded-xl bg-white/60 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-900/60 transition-colors"
            >
              {/* 仅在有封面图时渲染缩略图,避免空灰块占位 */}
              {p.thumbnail && (
                <div className="shrink-0 w-20 h-14 rounded-md bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
                  <Image src={p.thumbnail} alt="" fill className="object-cover" unoptimized />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-medium text-[#1F3864] dark:text-blue-200 line-clamp-1">
                    {p.title}
                  </p>
                  {mode === 'hot' && (
                    <span className={cn(
                      'shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold',
                      idx === 0 ? 'text-sky-600' : 'text-sky-400',
                    )}>
                      <Flame size={12} />{p.score.toFixed(2)}
                    </span>
                  )}
                </div>
                {p.summary && (
                  <p className="text-[12px] text-gray-500 line-clamp-1 mt-0.5">{p.summary}</p>
                )}
                <div className="flex gap-3 mt-1 text-[11px] text-gray-400">
                  <span className="inline-flex items-center gap-0.5"><Eye size={11} />{p.viewCount.toLocaleString('zh-CN')}</span>
                  <span className="inline-flex items-center gap-0.5"><MessageCircle size={11} />{p.commentCount}</span>
                  <span className="inline-flex items-center gap-0.5"><Calendar size={11} />{p.publishedAt.slice(0, 10)}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
