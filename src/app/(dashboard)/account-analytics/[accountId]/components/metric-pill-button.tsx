'use client'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  active: boolean
  onClick: () => void
}

export function MetricPillButton({ label, active, onClick }: Props) {
  return (
    // eslint-disable-next-line no-restricted-syntax
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center w-full px-4 py-2.5 rounded-full',
        'text-[13px] font-medium transition-all border-0 cursor-pointer',
        active
          ? 'bg-gradient-to-r from-sky-400 to-sky-500 text-white shadow-md shadow-sky-200/50'
          : 'bg-gray-50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
      )}
    >
      {label}
    </button>
  )
}
