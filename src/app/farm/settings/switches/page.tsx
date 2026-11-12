import { redirect } from "next/navigation"

/** The feature switches are on Settings · Choices now, with each module's settings. */
export default function SettingsSwitchesPage() {
  redirect("/farm/settings/choices")
}
