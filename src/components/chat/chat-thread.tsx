"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { SendHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ChatMessage = { id: string; mine: boolean; body: string; time: string; seen: boolean }

/**
 * One conversation, used by both the customer and the farm.
 * Refreshes every 20 seconds while the page is visible, so new replies appear without reloading.
 */
export function ChatThread({ messages, send, placeholder }: { messages: ChatMessage[]; send: (body: string) => Promise<{ ok: boolean; error?: string }>; placeholder: string }) {
  const t = useTranslations("chat")
  const te = useTranslations("errors")
  const router = useRouter()
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [messages.length])

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh()
    }, 20_000)
    return () => clearInterval(id)
  }, [router])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2" aria-live="polite">
        {messages.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex max-w-[85%] flex-col gap-0.5", m.mine ? "self-end items-end" : "self-start items-start")}>
            <p className={cn("whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed", m.mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border bg-card")}>{m.body}</p>
            <span className="text-xs text-muted-foreground tabular-nums">
              {m.time}
              {m.mine && <span className={cn("ml-1", m.seen && "text-primary")}>{m.seen ? `✓✓ ${t("seen")}` : `✓ ${t("sent")}`}</span>}
            </span>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault()
          const body = text.trim()
          if (!body) return
          setError(null)
          start(async () => {
            const r = await send(body)
            if (!r.ok) return setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
            setText("")
            router.refresh()
          })
        }}
      >
        <textarea
          rows={1}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 outline-none"
        />
        <Button type="submit" size="icon" className="size-11 shrink-0" disabled={pending || !text.trim()} aria-label={t("send")}>
          <SendHorizontal />
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
