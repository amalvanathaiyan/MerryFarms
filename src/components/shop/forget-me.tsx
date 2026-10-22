"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { forgetMeAction } from "@/app/actions/shop"

/** "Not you?" for a shared family phone: forget the customer on this phone only. */
export function ForgetMe() {
  const t = useTranslations("my")
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      className="self-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      onClick={() => {
        if (!armed) return setArmed(true)
        start(async () => {
          await forgetMeAction()
          router.refresh()
        })
      }}
    >
      {armed ? t("forgetConfirm") : t("notYou")}
    </button>
  )
}
