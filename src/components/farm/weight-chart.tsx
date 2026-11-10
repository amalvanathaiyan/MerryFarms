"use client"

import { useEffect, useRef, useState } from "react"

export interface ChartPoint {
  ageDays: number
  avgGrams: number
  /** Ready-made words for the tooltip lines under the value. */
  lines: string[]
}

const H = 210
const PAD = { top: 18, right: 64, bottom: 40, left: 46 }
const GRAM_STEPS = [25, 50, 100, 200, 250, 500, 1000, 2000]

/** A clean y-axis: 0 up to a round number, about four steps. */
function yScale(max: number) {
  const step = GRAM_STEPS.find((s) => Math.ceil((max * 1.08) / s) <= 5) ?? 2000
  const top = Math.max(step, Math.ceil((max * 1.08) / step) * step)
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) }
}

/** Week ticks across the ages weighed, at most about seven. */
function xScale(minAge: number, maxAge: number) {
  const from = Math.floor(minAge / 7)
  const to = Math.max(from + 1, Math.ceil(maxAge / 7))
  const every = [1, 2, 4, 8, 13, 26].find((e) => (to - from) / e <= 7) ?? 52
  const ticks: number[] = []
  for (let w = Math.ceil(from / every) * every; w <= to; w += every) ticks.push(w)
  return { from: from * 7, to: to * 7, ticks }
}

/**
 * Average weight per bird against age: one line in the chart colour over a light wash, ringed dots, hairline grid,
 * the latest value labelled at the end. Tap or move across it (or use the arrow keys) for each weighing's
 * details; every value is also in the table under it.
 */
export function WeightChart({
  points,
  label,
  axisAge,
  fmt,
  axisFmt,
  unit,
}: {
  points: ChartPoint[]
  label: string
  axisAge: string
  /** "1.25 kg" for a value. */
  fmt: (grams: number) => string
  /** Axis tick text: grams, or kilos when the axis reaches a kilo. */
  axisFmt: (grams: number, inKg: boolean) => string
  /** The weight axis's unit word. */
  unit: (inKg: boolean) => string
}) {
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(340)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ys = yScale(Math.max(...points.map((p) => p.avgGrams)))
  const xs = xScale(points[0].ageDays, points[points.length - 1].ageDays)
  const inKg = ys.top >= 1000
  const plotW = w - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const x = (age: number) => PAD.left + ((age - xs.from) / (xs.to - xs.from)) * plotW
  const y = (g: number) => PAD.top + plotH - (g / ys.top) * plotH
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.ageDays).toFixed(1)} ${y(p.avgGrams).toFixed(1)}`).join("")
  const area = `${path}L${x(points[points.length - 1].ageDays).toFixed(1)} ${y(0)}L${x(points[0].ageDays).toFixed(1)} ${y(0)}Z`
  const last = points[points.length - 1]

  // The nearest weighing to the pointer, by age (readers aim at a time, not at a 2px line).
  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    const px = clientX - r.left
    let best = 0
    points.forEach((p, i) => {
      if (Math.abs(x(p.ageDays) - px) < Math.abs(x(points[best].ageDays) - px)) best = i
    })
    setActive(best)
  }
  const a = active == null ? null : points[active]
  const tipLeft = a ? Math.min(Math.max(x(a.ageDays) - 90, 0), w - 180) : 0

  return (
    <div ref={box} className="relative w-full select-none">
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        role="img"
        aria-label={label}
        tabIndex={0}
        className="block touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
        onFocus={() => setActive((i) => i ?? points.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? points.length) - 1))
          else if (e.key === "ArrowRight") setActive((i) => Math.min(points.length - 1, (i ?? -1) + 1))
          else if (e.key === "Escape") setActive(null)
          else return
          e.preventDefault()
        }}
      >
        {/* Grid and axes: hairlines, recessive. */}
        <g stroke="var(--color-border)" strokeWidth={1}>
          {ys.ticks.map((g) => (
            <line key={g} x1={PAD.left} x2={w - PAD.right + 8} y1={y(g)} y2={y(g)} />
          ))}
        </g>
        <g className="fill-muted-foreground tabular-nums" style={{ fontSize: 11 }}>
          {ys.ticks.map((g) => (
            <text key={g} x={PAD.left - 8} y={y(g)} dy="0.35em" textAnchor="end">
              {axisFmt(g, inKg)}
            </text>
          ))}
          {xs.ticks.map((wk) => (
            <text key={wk} x={x(wk * 7)} y={H - PAD.bottom + 16} textAnchor="middle">
              {wk}
            </text>
          ))}
          <text x={PAD.left + plotW / 2} y={H - 6} textAnchor="middle">
            {axisAge}
          </text>
          {/* The unit, once, at the top of the weight axis. */}
          <text x={PAD.left - 8} y={PAD.top - 8} textAnchor="end">
            {unit(inKg)}
          </text>
        </g>

        {/* The growth line over a light wash. */}
        <path d={area} fill="var(--color-chart-1)" fillOpacity={0.1} />
        <path d={path} fill="none" stroke="var(--color-chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {a && <line x1={x(a.ageDays)} x2={x(a.ageDays)} y1={PAD.top - 6} y2={y(0)} stroke="var(--color-muted-foreground)" strokeWidth={1} />}

        {points.map((p, i) => (
          <circle key={i} cx={x(p.ageDays)} cy={y(p.avgGrams)} r={i === active ? 6 : 4} fill="var(--color-chart-1)" stroke="var(--color-card)" strokeWidth={2} />
        ))}

        {/* The latest weighing, labelled at the end of the line (in text colour, not the line's). */}
        <text x={x(last.ageDays) + 10} y={y(last.avgGrams)} dy="0.35em" className="fill-foreground font-bold tabular-nums" style={{ fontSize: 13 }}>
          {fmt(last.avgGrams)}
        </text>
      </svg>

      {a && (
        <div role="status" className="pointer-events-none absolute top-0 z-10 rounded-xl border bg-card px-3 py-2 text-sm shadow-md" style={{ left: tipLeft, width: 180 }}>
          <div className="text-base font-bold tabular-nums">{fmt(a.avgGrams)}</div>
          {a.lines.map((l) => (
            <div key={l} className="leading-snug text-muted-foreground">
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
