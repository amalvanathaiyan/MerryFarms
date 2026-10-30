/**
 * Makes someone a FarmForYou platform admin (all farms: add farms, plans, trials, suspend).
 * Not a farm role: it gives no access to any farm's own app.
 *
 *   npm run admin:add -- --email you@example.com --password 'a-long-password' --name "Amal"
 *
 * If the email already has a login (e.g. they own a farm too), it is reused; --password can be left out.
 * Then sign in at /login?next=/admin (or open /admin).
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { createClient } from "@supabase/supabase-js"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

async function main() {
  const email = arg("email")
  const password = arg("password")
  const name = arg("name")
  if (!email || !name) throw new Error("--email and --name are required")

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL })) })

  try {
    let userId: string | undefined
    if (password) {
      const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
      if (data.user) userId = data.user.id
      else if (!error?.message.toLowerCase().includes("already")) throw error
    }
    if (!userId) {
      const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      if (error) throw error
      userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id
      if (!userId) throw new Error("No login with that email. Pass --password to create one.")
    }

    await prisma.platformAdmin.upsert({
      where: { authUserId: userId },
      update: { name, email },
      create: { authUserId: userId, name, email },
    })
    console.log(`${name} <${email}> is now a FarmForYou platform admin. Sign in at /login?next=/admin.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
