import type { NextConfig } from "next"
import withPWAInit from "@ducanh2912/next-pwa"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

// Installable web app for farm staff and customers (no Play Store needed at launch).
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  fallbacks: {
    document: "/offline",
  },
  // Phone-notification handlers, added to the generated service worker.
  customWorkerSrc: "src/worker",
})

const nextConfig: NextConfig = {
  // Dev server only: let phones on the same Wi-Fi load the app (npm run demo / dev).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.local"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
}

export default withNextIntl(withPWA(nextConfig))
