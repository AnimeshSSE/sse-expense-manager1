'use client'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

const sizeConfig = {
  sm: {
    icon: { width: 32, height: 32 },
    text: 'text-sm',
    subtext: 'text-[10px]',
    gap: 'gap-2',
    boltSize: 12,
  },
  md: {
    icon: { width: 56, height: 56 },
    text: 'text-lg',
    subtext: 'text-xs',
    gap: 'gap-3',
    boltSize: 18,
  },
  lg: {
    icon: { width: 72, height: 72 },
    text: 'text-2xl',
    subtext: 'text-sm',
    gap: 'gap-4',
    boltSize: 24,
  },
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const config = sizeConfig[size]

  return (
    <div className={`inline-flex items-center ${config.gap}`}>
      {/* Icon */}
      <div
        className="relative flex items-center justify-center rounded-xl bg-stone-900 shadow-lg flex-shrink-0"
        style={{ width: config.icon.width, height: config.icon.height }}
      >
        {/* S.S. monogram */}
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: config.icon.width * 0.7, height: config.icon.height * 0.7 }}
        >
          {/* S.S. text */}
          <text
            x="20"
            y="22"
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="800"
            fontSize="14"
            fill="white"
            letterSpacing="-0.5"
          >
            S.S.
          </text>
          {/* Lightning bolt accent */}
          <path
            d="M30 4L22 18H28L20 36"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.9"
          />
        </svg>
      </div>

      {/* Text */}
      {showText && (
        <div className="flex flex-col min-w-0">
          <span
            className={`font-bold text-stone-900 leading-tight ${config.text}`}
          >
            S.S. Electricals
          </span>
          <span
            className={`text-stone-500 font-normal leading-tight mt-0.5 ${config.subtext}`}
          >
            {size === 'sm' ? 'Expense Mgmt' : 'Expense Management'}
          </span>
        </div>
      )}
    </div>
  )
}
