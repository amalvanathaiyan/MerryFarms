"use client"

import { useEffect, useMemo, useState } from "react"
import { msToNextPhase, phaseAt, sceneFor, type SceneKind, type ScenePhase, type SceneSpot } from "@/domain/scenes"
import { cn } from "@/lib/utils"
import { CartArt } from "./cart-art"
import { farmSceneSvg, SCENE_RATIO, type SceneWords } from "./farm-scene-svg"

export interface SceneProps {
  /** Worked out on the server (sceneFor / phaseAt), so the first paint matches. */
  kind: SceneKind
  phase: ScenePhase
  farmScenes: boolean
  spot: SceneSpot
  words: SceneWords
}

/**
 * The farm's picture: its own live scene in the light of the time of day, or FarmForYou's bullock cart.
 * A page left open redraws when the light changes (dawn, day, evening, night).
 */
export function FarmScene({ scene, className, priority }: { scene: SceneProps; className?: string; priority?: boolean }) {
  const [now, setNow] = useState<{ kind: SceneKind; phase: ScenePhase }>({ kind: scene.kind, phase: scene.phase })

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const at = new Date()
      setNow({ kind: sceneFor({ farmScenes: scene.farmScenes, spot: scene.spot, at }), phase: phaseAt(at) })
      timer = setTimeout(tick, msToNextPhase(at))
    }
    timer = setTimeout(tick, msToNextPhase(new Date()))
    return () => clearTimeout(timer)
  }, [scene.farmScenes, scene.spot])

  const svg = useMemo(() => (now.kind === "cart" ? null : farmSceneSvg(now.kind, now.phase, scene.words)), [now, scene.words])

  if (!svg || now.kind === "cart") {
    // The cart's drawing has a daytime sky. In the big picture, evening and night lay their light over it
    // (dusk, then moonlight), so it never shows the sun beside "Good night".
    const light = scene.spot === "hero" && (now.phase === "evening" || now.phase === "night") ? now.phase : null
    const cart = <CartArt variant={scene.spot === "hero" ? "scene" : "plain"} priority={priority} className={light ? undefined : className} />
    if (!light) return cart
    return (
      <div className={cn("relative overflow-hidden", className)}>
        {cart}
        <div aria-hidden className={cn("pointer-events-none absolute inset-0", light === "night" ? "cart-night" : "cart-dusk")} />
      </div>
    )
  }
  return (
    <div
      className={cn("w-full overflow-hidden", className)}
      style={{ aspectRatio: SCENE_RATIO[now.kind] }}
      // Built from our own drawing code; the only outside text (farm name, labels) is escaped in farmSceneSvg.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
