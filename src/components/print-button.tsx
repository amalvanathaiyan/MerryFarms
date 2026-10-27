"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="outline" className="flex-1" onClick={() => window.print()}>
      <Printer /> {label}
    </Button>
  )
}
