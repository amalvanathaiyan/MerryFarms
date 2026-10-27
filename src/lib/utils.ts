import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Our own theme sizes (globals.css @theme), so tailwind-merge treats them as font sizes. Without this it reads
// "text-tab" as a text colour and drops it whenever a colour class like "text-primary" comes after it.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["tab"] }] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
