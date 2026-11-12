import { redirect } from "next/navigation"

/** The automations' switches and hours are settings now, on Settings · Choices. */
export default function SettingsAutomationsPage() {
  redirect("/farm/settings/choices")
}
