import { headers } from "next/headers"
import { auth } from "../lib/auth"

export const dynamic = "force-dynamic"

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() })
  return <p>{session ? `Signed in as ${session.user.email}` : "Signed out"}</p>
}
