/**
 * Creates a staff login for a farm (Supabase Auth user + StaffMember row).
 *
 *   npm run staff:add -- --email owner@example.com --password 'a-long-password' --name "Amal" --roles owner
 *   npm run staff:add -- --email desk@example.com --password '...' --name "Desk" --roles order_desk,packing --tenant merryfarms
 *
 * If the email already has a login, it is reused and only linked to the farm.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { createClient } from "@supabase/supabase-js"
import { PrismaClient, type StaffRole } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const ROLES: StaffRole[] = ["owner", "order_desk", "packing", "delivery"]

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

async function main() {
  const email = arg("email")
  const password = arg("password")
  const name = arg("name")
  const slug = arg("tenant") ?? process.env.DEFAULT_TENANT_SLUG ?? "merryfarms"
  const roles = (arg("roles") ?? "owner").split(",").map((r) => r.trim()) as StaffRole[]

  if (!email || !name) throw new Error("--email and --name are required")
  if (roles.some((r) => !ROLES.includes(r))) throw new Error(`--roles must be from: ${ROLES.join(", ")}`)

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL })) })

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } })
    if (!tenant) throw new Error(`No farm with slug "${slug}". Run npm run db:seed first.`)

    let userId: string | undefined
    if (password) {
      const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
      if (data.user) userId = data.user.id
      else if (!error?.message.toLowerCase().includes("already")) throw error
    }
    if (!userId) {
      // Existing login: find it by email.
      const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      if (error) throw error
      userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id
      if (!userId) throw new Error("No login with that email. Pass --password to create one.")
    }

    await prisma.staffMember.upsert({
      where: { tenantId_authUserId: { tenantId: tenant.id, authUserId: userId } },
      update: { name, roles, email, isActive: true },
      create: { tenantId: tenant.id, authUserId: userId, name, roles, email },
    })
    console.log(`${name} <${email}> can now sign in to ${tenant.nameEn} as ${roles.join(", ")}.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
