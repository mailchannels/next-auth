import { auth } from "../auth"

export const dynamic = "force-dynamic"

export default async function Home() {
  const session = await auth()
  return <p>{session ? `Signed in as ${session.user.email}` : "Signed out"}</p>
}
