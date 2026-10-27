"use client"

import { useState } from "react"

/**
 * Net sales per day as columns. One series, so no legend; the section title names it.
 * Columns ≤ 24px wide with a 2px gap, 4px rounded at the value end and square at the
 * baseline; negative days (more returned than sold) hang below zero. Hover or tap a day
 * for its value; the same numbers are in the table below the chart.
 */
export function DailySalesChart({ days, tooltip }: { days: { date: string; label: string; value: string; paise: number }[]; tooltip: string }) {
  const [active, setActive] = useState<number | null>(null)
  const W = 640
  const H = 180
  const padL = 48
  const padB = 24
  const plotW = W - padL - 8
  const plotH = H - padB - 8

  const max = Math.max(0, ...days.map((d) => d.paise))
  const min = Math.min(0, ...days.map((d) => d.paise))
  const step = niceStep((max - min) / 4 || 100_00)
  const top = Math.ceil(max / step) * step || step
  const bottom = Math.floor(min / step) * step
  const y = (v: number) => 8 + ((top - v) / (top - bottom)) * plotH
  const band = plotW / days.length
  const barW = Math.max(2, Math.min(24, band - 2))
  const ticks: number[] = []
  for (let v = bottom; v <= top + 1; v += step) ticks.push(v)
  const labelEvery = Math.ceil(days.length / 8)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={tooltip}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - 8} y1={y(v)} y2={y(v)} stroke="hsl(var(--border))" strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={padL - 6} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
              {compactRupees(v)}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = padL + i * band + (band - barW) / 2
          const y0 = y(0)
          const y1 = y(d.paise)
          const h = Math.abs(y1 - y0)
          const up = d.paise >= 0
          return (
            <g key={d.date}>
              {h > 0 && <path d={roundedColumn(x, up ? y1 : y0, barW, h, up)} fill="var(--chart-1)" opacity={active === null || active === i ? 1 : 0.45} />}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                  {d.label}
                </text>
              )}
              {/* Hit target: the whole day band, taller than the column. */}
              <rect
                x={padL + i * band}
                y={8}
                width={band}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.label}: ${d.value}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(active === i ? null : i)}
                className="cursor-pointer outline-none"
              />
            </g>
          )
        })}
      </svg>
      {active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 rounded-lg border bg-popover px-2.5 py-1.5 text-sm text-popover-foreground shadow-sm tabular-nums"
          style={{ left: `clamp(0px, calc(${((padL + (active + 0.5) * band) / W) * 100}% - 4rem), calc(100% - 8rem))` }}
        >
          <div className="text-xs text-muted-foreground">{days[active].label}</div>
          <div className="font-semibold">{days[active].value}</div>
        </div>
      )}
    </div>
  )
}

/** A column with 4px rounded corners at its value end only. */
function roundedColumn(x: number, yTop: number, w: number, h: number, up: boolean) {
  const r = Math.min(4, w / 2, h)
  if (up) return `M${x},${yTop + h}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yTop + h}Z`
  return `M${x},${yTop}V${yTop + h - r}Q${x},${yTop + h} ${x + r},${yTop + h}H${x + w - r}Q${x + w},${yTop + h} ${x + w},${yTop + h - r}V${yTop}Z`
}

/** 1 / 2 / 5 × 10ⁿ paise steps, so ticks land on round rupee amounts. */
function niceStep(raw: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))))
  const f = raw / exp
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp
}

function compactRupees(paise: number) {
  const r = paise / 100
  if (Math.abs(r) >= 100_000) return `₹${(r / 100_000).toFixed(r % 100_000 ? 1 : 0)}L`
  if (Math.abs(r) >= 1_000) return `₹${(r / 1_000).toFixed(r % 1_000 ? 1 : 0)}k`
  return `₹${r}`
}
