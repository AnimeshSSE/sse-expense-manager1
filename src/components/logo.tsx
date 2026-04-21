'use client'

import { Zap } from 'lucide-react'

export function Logo({ size = 'default' }: { size?: 'sm' | 'default' | 'lg' }) {
  const sizeMap = {
    sm: { icon: 20, text: 'text-lg' },
    default: { icon: 28, text: 'text-xl' },
    lg: { icon: 36, text: 'text-2xl' },
  }
  const s = sizeMap[size]

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500 text-white">
        <Zap className="w-5 h-5" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className={`${s.text} font-bold text-navy-950 tracking-tight`}>
          S.S. Electricals
        </span>
        {size !== 'sm' && (
          <span className="text-[10px] font-medium text-navy-500 uppercase tracking-widest">
            Expense Manager
          </span>
        )}
      </div>
    </div>
  )
}
