import { Egg, Fish, Milk, Sprout, Store, Tractor, Truck, type LucideIcon } from "lucide-react"
import type { ModuleKey } from "@/domain/modules"

const ICONS: Record<ModuleKey, LucideIcon> = { core: Tractor, selling: Store, buying: Truck, poultry: Egg, livestock: Milk, fishery: Fish, crops: Sprout }

/** A module's picture, always shown beside its name. */
export function ModuleIcon({ module, className }: { module: ModuleKey; className?: string }) {
  const Icon = ICONS[module]
  return <Icon className={className} aria-hidden />
}
