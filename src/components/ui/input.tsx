"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { typeTamil, type Typing } from "@/domain/tamil-typing"
import { cn } from "@/lib/utils"

const setNativeValue = Object.getOwnPropertyDescriptor(globalThis.HTMLInputElement?.prototype ?? {}, "value")?.set

function Input(props: React.ComponentProps<"input">) {
  return props.lang === "ta" ? <TamilInput {...props} /> : <PlainInput {...props} />
}

/** A Tamil box: English letters become Tamil by sound as they are typed, with no keyboard to set up. */
function TamilInput({ onChange, onSelect, onCompositionStart, onCompositionEnd, ...props }: React.ComponentProps<"input">) {
  const t = useTranslations("common")
  const [on, setOn] = React.useState(true)
  const typing = React.useRef<Typing>({ text: "", word: "" })
  // Rewriting a box mid-composition garbles phone keyboards, so those words change when the keyboard lets go of them.
  const composing = React.useRef(false)

  const converted = (el: HTMLInputElement) => {
    const caret = el.selectionStart ?? el.value.length
    typing.current = typeTamil(typing.current, el.value.slice(0, caret))
    return { value: typing.current.text + el.value.slice(caret), caret: typing.current.text.length }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <PlainInput
        {...props}
        {...(on && { autoCapitalize: "none", autoCorrect: "off", spellCheck: false })}
        onChange={(e) => {
          if (on && !composing.current) {
            const el = e.currentTarget
            const { value, caret } = converted(el)
            if (value !== el.value) {
              el.value = value
              el.setSelectionRange(caret, caret)
            }
          }
          onChange?.(e)
        }}
        onSelect={(e) => {
          const el = e.currentTarget
          const before = el.value.slice(0, el.selectionStart ?? 0)
          if (!composing.current && before !== typing.current.text) typing.current = { text: before, word: "" }
          onSelect?.(e)
        }}
        onCompositionStart={(e) => {
          composing.current = true
          onCompositionStart?.(e)
        }}
        onCompositionEnd={(e) => {
          composing.current = false
          const el = e.currentTarget
          if (on) {
            const { value, caret } = converted(el)
            if (value !== el.value) {
              // Set around React, then announce it, so the form hears about the new text.
              setNativeValue?.call(el, value)
              el.setSelectionRange(caret, caret)
              el.dispatchEvent(new Event("input", { bubbles: true }))
            }
          }
          onCompositionEnd?.(e)
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm font-normal text-muted-foreground">
        {on && (
          <span className="min-w-0">
            {t("tamilTypingHint")} <span className="block">{t("tamilTypingCapitals")}</span>
          </span>
        )}
        <button
          type="button"
          aria-pressed={on}
          onClick={() => setOn(!on)}
          className="min-h-9 rounded-full border bg-card px-3 py-1 font-medium text-foreground transition-colors hover:bg-accent active:scale-95"
        >
          {on ? t("tamilTypingOff") : t("tamilTypingOn")}
        </button>
      </div>
    </div>
  )
}

function PlainInput({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      suppressHydrationWarning
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
