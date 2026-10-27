import { CartArt } from "@/components/art/cart-art"

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-4 text-center">
      {/* Precached with the app, so the cart still shows with no connection. */}
      <CartArt variant="plain" className="mx-auto max-w-xs" priority />
      <h1 className="text-2xl font-bold">இணைய இணைப்பு இல்லை</h1>
      <p className="text-muted-foreground">இணையம் வந்ததும் இந்தப் பக்கம் தானாகத் திறக்கும்.</p>
      <p className="text-sm text-muted-foreground">You&apos;re offline. This page will reload when you&apos;re back online.</p>
    </main>
  )
}
