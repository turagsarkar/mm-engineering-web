'use client'
import { useState } from 'react'

// ---------------------------------------------------------------------------
// Shared, polished chart primitives used across the dashboards.
// SVG + Tailwind only (no chart library). Accent: blue→indigo gradient.
// ---------------------------------------------------------------------------

export interface Point { label: string; value: number }
export interface Series { label: string; color: string }

const GRID = [1, 0.75, 0.5, 0.25, 0]

function niceMax(v: number) {
  if (v <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow
}

/* ---------------- Vertical bar chart (single series, peak highlighted) -------- */
export function BarChart({ data, suffix = '', maxValue, height = 224 }: {
  data: Point[]; suffix?: string; maxValue?: number; height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const top = maxValue ?? niceMax(Math.max(1, ...data.map(d => d.value)))
  const peak = Math.max(...data.map(d => d.value))

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        {/* gridlines + y labels */}
        {GRID.map(g => (
          <div key={g} className="absolute left-0 right-0 flex items-center gap-2" style={{ top: `${(1 - g) * 100}%` }}>
            <span className="w-8 text-[10px] text-gray-300 text-right tabular-nums">{Math.round(top * g)}</span>
            <div className="flex-1 border-t border-dashed border-gray-100" />
          </div>
        ))}
        {/* bars */}
        <div className="absolute inset-0 pl-10 flex items-end gap-2 sm:gap-3">
          {data.map((d, i) => {
            const isPeak = d.value === peak && peak > 0
            const active = hover === i || isPeak
            const h = `${(d.value / top) * 100}%`
            return (
              <div key={d.label} className="group relative flex-1 h-full flex flex-col justify-end items-center min-w-[24px]"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {/* track */}
                <div className="absolute inset-x-0 bottom-0 top-0 rounded-xl bg-gray-50" />
                {/* value pill */}
                {active && (
                  <div className="absolute -top-1 z-10 -translate-y-full px-2 py-1 rounded-lg bg-gray-900 text-white text-[10px] font-semibold whitespace-nowrap shadow-lg">
                    {d.value.toLocaleString()}{suffix}
                  </div>
                )}
                {/* fill */}
                <div className={`relative w-full rounded-xl transition-all duration-300 ${
                  isPeak ? 'bg-gradient-to-t from-blue-600 to-indigo-400 shadow-md shadow-blue-200'
                  : 'bg-gradient-to-t from-blue-200 to-blue-100 group-hover:from-blue-300 group-hover:to-blue-200'
                }`} style={{ height: h, minHeight: d.value > 0 ? 6 : 0 }} />
              </div>
            )
          })}
        </div>
      </div>
      {/* x labels */}
      <div className="pl-10 flex gap-2 sm:gap-3 mt-2">
        {data.map(d => (
          <span key={d.label} className="flex-1 min-w-[24px] text-center text-[10px] text-gray-400 truncate" title={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Grouped vertical bars (multi-series) ------------------------ */
export function GroupedBarChart({ buckets, series, height = 208 }: {
  buckets: { label: string; values: number[] }[]; series: Series[]; height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const top = niceMax(Math.max(1, ...buckets.flatMap(b => b.values)))
  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        {GRID.map(g => (
          <div key={g} className="absolute left-0 right-0 flex items-center gap-2" style={{ top: `${(1 - g) * 100}%` }}>
            <span className="w-8 text-[10px] text-gray-300 text-right tabular-nums">{Math.round(top * g)}</span>
            <div className="flex-1 border-t border-dashed border-gray-100" />
          </div>
        ))}
        <div className="absolute inset-0 pl-10 flex items-end gap-1.5 overflow-x-auto">
          {buckets.map((b, i) => (
            <div key={b.label} className="group relative flex-1 h-full flex flex-col justify-end items-center min-w-[34px]"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {hover === i && b.values.some(v => v > 0) && (
                <div className="absolute -top-1 z-10 -translate-y-full px-2 py-1.5 rounded-lg bg-gray-900 text-white text-[10px] whitespace-nowrap shadow-lg space-y-0.5">
                  {series.map((s, k) => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}: <span className="font-semibold ml-auto">{b.values[k]}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="relative w-full h-full flex items-end justify-center gap-[3px]">
                {b.values.map((v, k) => (
                  <div key={k} className="flex-1 max-w-[10px] rounded-md transition-all duration-300"
                    style={{ height: `${(v / top) * 100}%`, minHeight: v > 0 ? 4 : 0, backgroundColor: series[k].color, opacity: hover === null || hover === i ? 1 : 0.4 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="pl-10 flex gap-1.5 mt-2">
        {buckets.map(b => (
          <span key={b.label} className="flex-1 min-w-[34px] text-center text-[9px] text-gray-400 truncate">{b.label}</span>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Horizontal bars -------------------------------------------- */
export function HBarChart({ data }: { data: { label: string; count: number }[] }) {
  const top = niceMax(Math.max(1, ...data.map(d => d.count)))
  return (
    <div className="space-y-2.5">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-3 text-xs">
          <span className="w-40 shrink-0 truncate text-gray-600" title={d.label}>{d.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
            <div className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-500"
              style={{ width: `${Math.max(2, (d.count / top) * 100)}%` }} />
          </div>
          <span className="w-8 text-right font-semibold text-gray-700 tabular-nums">{d.count}</span>
        </div>
      ))}
    </div>
  )
}

/* ---------------- Smooth area + line chart ----------------------------------- */
// Catmull-Rom → cubic bezier for a smooth curve.
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`
  }
  return d
}

export function AreaLineChart({ data, labels, suffix = '', maxValue }: {
  data: number[]; labels: string[]; suffix?: string; maxValue?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  if (data.length === 0) return null
  const W = 560, H = 200, padX = 12, padTop = 18, padBottom = 22
  const top = maxValue ?? niceMax(Math.max(1, ...data))
  const n = data.length
  const x = (i: number) => n === 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (n - 1)
  const y = (v: number) => padTop + (1 - v / top) * (H - padTop - padBottom)
  const pts = data.map((v, i) => [x(i), y(v)] as [number, number])
  const line = smoothPath(pts)
  const area = `${line} L ${x(n - 1)},${H - padBottom} L ${x(0)},${H - padBottom} Z`
  const peakIdx = data.indexOf(Math.max(...data))

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}
        onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* gridlines */}
        {GRID.map(g => {
          const gy = padTop + g * (H - padTop - padBottom)
          return <line key={g} x1={padX} y1={gy} x2={W - padX} y2={gy} stroke="#f3f4f6" strokeDasharray="3 3" />
        })}
        <path d={area} fill="url(#areaFill)" />
        <path d={line} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" />
        {/* hover capture columns */}
        {data.map((v, i) => (
          <rect key={i} x={x(i) - (W / n) / 2} y={0} width={W / n} height={H} fill="transparent"
            onMouseEnter={() => setHover(i)} />
        ))}
        {/* markers */}
        {data.map((v, i) => {
          const show = hover === i || (hover === null && i === peakIdx)
          return (
            <g key={i}>
              {show && <line x1={x(i)} y1={padTop} x2={x(i)} y2={H - padBottom} stroke="#c7d2fe" strokeWidth="1" />}
              <circle cx={x(i)} cy={y(v)} r={show ? 5 : 3} fill="#fff" stroke="#4f46e5" strokeWidth="2.5" />
            </g>
          )
        })}
        {/* tooltip */}
        {(() => {
          const i = hover ?? peakIdx
          if (i < 0) return null
          const tx = Math.min(Math.max(x(i), 46), W - 46)
          return (
            <g transform={`translate(${tx}, ${Math.max(y(data[i]) - 34, 4)})`}>
              <rect x={-44} y={0} width={88} height={26} rx={6} fill="#111827" />
              <text x={0} y={17} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600">
                {labels[i]}: {data[i].toLocaleString()}{suffix}
              </text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

/* ---------------- Donut (segments + legend) ---------------------------------- */
export function DonutChart({ segments, centerValue, centerLabel }: {
  segments: { label: string; value: number; color: string }[]
  centerValue: string; centerLabel: string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const R = 56, SW = 18, C = 2 * Math.PI * R
  const gap = segments.length > 1 ? 0.012 : 0 // small visual gap between segments
  let acc = 0
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg viewBox="0 0 150 150" className="h-40 w-40 shrink-0 -rotate-90">
        <circle cx="75" cy="75" r={R} fill="none" stroke="#f3f4f6" strokeWidth={SW} />
        {segments.map(s => {
          const frac = s.value / total
          const len = Math.max(0, frac - gap) * C
          const dash = `${len} ${C - len}`
          const offset = -acc * C
          acc += frac
          if (s.value === 0) return null
          return (
            <circle key={s.label} cx="75" cy="75" r={R} fill="none" stroke={s.color} strokeWidth={SW}
              strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="round" />
          )
        })}
      </svg>
      <div className="relative -ml-[10.5rem] h-40 w-40 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold text-gray-900">{centerValue}</span>
        <span className="text-[11px] text-gray-400">{centerLabel}</span>
      </div>
      <div className="space-y-2 text-sm min-w-[10rem] flex-1">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-gray-600">{s.label}</span>
            <span className="font-semibold text-gray-900 ml-auto tabular-nums">{s.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
