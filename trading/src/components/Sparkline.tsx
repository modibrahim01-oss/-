import { useMemo } from 'react'

/**
 * منحنى مصغّر بلا محاور ولا تلميحات — إشارة اتجاه فقط.
 * مرسوم يدوياً بـ SVG لأن الرسم هنا زخرفة صغيرة داخل رقم البطل،
 * والمكتبة الكاملة محجوزة لشاشة الرسوم.
 */
export function Sparkline({
  values,
  className,
  positive,
}: {
  values: number[]
  className?: string
  positive: boolean
}) {
  const width = 300
  const height = 64

  const path = useMemo(() => {
    if (values.length < 2) return null
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    // الزمن يجري من اليمين (الأقدم) إلى اليسار (الأحدث) — نفس اتجاه القراءة
    // في الواجهة، ونفس اتجاه كل رسوم هذا التطبيق.
    const points = values.map((value, index) => {
      const x = width - (index / (values.length - 1)) * width
      const y = height - ((value - min) / span) * (height - 8) - 4
      return [x, y] as const
    })
    const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const area = `${line} L${width},${height} L0,${height} Z`
    return { line, area }
  }, [values])

  if (!path) return null

  const stroke = positive ? '#3FA96A' : '#D45C50'
  const gradientId = positive ? 'spark-gain' : 'spark-loss'

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill={`url(#${gradientId})`} />
      <path
        d={path.line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
