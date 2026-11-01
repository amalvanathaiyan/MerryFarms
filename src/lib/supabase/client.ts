import { createBrowserClient } from "@supabase/ssr"
import { authCookieOptions } from "./cookie-options"

/**
 * Browser-side Supabase client for Client Components.
 * Use this in "use client" components only.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: authCookieOptions() }
  )
}
