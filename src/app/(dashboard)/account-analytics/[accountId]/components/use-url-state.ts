'use client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import type { Granularity, MetricKey } from '@/lib/account-analytics/platform-meta'

export type AccountAnalyticsTab = 'analytics' | 'reports'
export type TopSort = 'hot' | 'latest'
export type CloudRange = '7d' | '30d'

export interface AccountAnalyticsURLState {
  tab: AccountAnalyticsTab
  granularity: Granularity
  metric: MetricKey
  topSort: TopSort
  cloudRange: CloudRange
  setTab: (v: AccountAnalyticsTab) => void
  setGranularity: (v: Granularity) => void
  setMetric: (v: MetricKey) => void
  setTopSort: (v: TopSort) => void
  setCloudRange: (v: CloudRange) => void
}

const DEFAULTS = {
  tab: 'analytics' as AccountAnalyticsTab,
  granularity: 'day' as Granularity,
  metric: 'likes' as MetricKey,
  topSort: 'hot' as TopSort,
  cloudRange: '7d' as CloudRange,
}

function read<T extends string>(sp: URLSearchParams, key: string, allowed: readonly T[], fallback: T): T {
  const v = sp.get(key) as T | null
  return v && (allowed as readonly string[]).includes(v) ? v : fallback
}

export function useAccountAnalyticsURLState(): AccountAnalyticsURLState {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const tab = read(sp, 'tab', ['analytics', 'reports'] as const, DEFAULTS.tab)
  const granularity = read(sp, 'granularity', ['day', 'week', 'month'] as const, DEFAULTS.granularity)
  const metric = read(sp, 'metric', ['likes', 'comments', 'shares', 'favorites', 'views', 'compositeScore'] as const, DEFAULTS.metric)
  const topSort = read(sp, 'topSort', ['hot', 'latest'] as const, DEFAULTS.topSort)
  const cloudRange = read(sp, 'cloudRange', ['7d', '30d'] as const, DEFAULTS.cloudRange)

  const update = useCallback((patch: Partial<Record<string, string>>) => {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) next.delete(k)
      else next.set(k, v)
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [router, pathname, sp])

  return {
    tab, granularity, metric, topSort, cloudRange,
    setTab: (v) => update({ tab: v }),
    setGranularity: (v) => update({ granularity: v }),
    setMetric: (v) => update({ metric: v }),
    setTopSort: (v) => update({ topSort: v }),
    setCloudRange: (v) => update({ cloudRange: v }),
  }
}
