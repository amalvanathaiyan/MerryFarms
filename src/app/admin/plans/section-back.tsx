import Link from "next/link"
import { ArrowLeft } from "lucide-react"

/** "← Plans": back to the list, with the word beside the arrow. */
export function SectionBack({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex min-h-11 items-center gap-1.5 self-start rounded-xl px-2 font-semibold text-primary hover:underline">
      <ArrowLeft className="size-4" aria-hidden />
      {label}
    </Link>
  )
}
