// Behaviour script for the MailChannels Auth.js provider and the Better Auth
// helper: request a magic link for user@example.test in each sample app, expect
// exactly one valid send at the stub Email API containing the sign-in URL, then
// follow the link and expect a session for that user.
import { writeFileSync } from "node:fs"

const STUB = process.env.STUB_URL ?? "http://localhost:8080"
const AUTHJS = process.env.AUTHJS_URL ?? "http://localhost:3001"
const BETTER_AUTH = process.env.BETTER_AUTH_URL ?? "http://localhost:3002"
const EMAIL = "user@example.test"

class Jar {
  cookies = new Map()
  store(res) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";")
      const i = pair.indexOf("=")
      this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1))
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ")
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`)
}

async function resetStub() {
  await fetch(`${STUB}/sends`, { method: "DELETE" })
}

async function oneSend(linkPattern) {
  const { sends, rejected } = await (await fetch(`${STUB}/sends`)).json()
  assert(rejected.length === 0, `stub rejected ${JSON.stringify(rejected)}`)
  assert(sends.length === 1, `expected 1 send, got ${sends.length}`)
  const [send] = sends
  const to = send.body.personalizations[0].to
  assert(to.length === 1 && to[0].email === EMAIL, `recipient ${JSON.stringify(to)}`)
  assert(send.apiKey === "synthetic-test-key", "API key sent in X-Api-Key")
  const text = send.body.content.find((c) => c.type === "text/plain")?.value
  const html = send.body.content.find((c) => c.type === "text/html")?.value
  assert(text && html, "both text/plain and text/html parts")
  const link = text.match(linkPattern)?.[0]
  assert(link, `sign-in URL matching ${linkPattern} in the text part`)
  assert(html.includes(link), "same sign-in URL in the HTML part")
  return { send, link }
}

async function authjs() {
  await resetStub()
  const jar = new Jar()
  const csrfRes = await fetch(`${AUTHJS}/api/auth/csrf`)
  jar.store(csrfRes)
  const { csrfToken } = await csrfRes.json()

  const signIn = await fetch(`${AUTHJS}/api/auth/signin/mailchannels`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: new URLSearchParams({ email: EMAIL, csrfToken, callbackUrl: `${AUTHJS}/` }),
  })
  jar.store(signIn)
  const location = signIn.headers.get("location") ?? ""
  assert(signIn.status === 302, `sign-in status ${signIn.status}`)
  assert(location.includes("/api/auth/verify-request"), `sign-in redirect ${location}`)

  const { send, link } = await oneSend(
    new RegExp(`${AUTHJS}/api/auth/callback/mailchannels\\?\\S+`)
  )
  assert(send.body.from.email === "no-reply@example.test", "from address")
  assert(send.body.from.name === "E2E Test", "from name")

  const callback = await fetch(link, {
    redirect: "manual",
    headers: { Cookie: jar.header() },
  })
  jar.store(callback)
  assert(callback.status === 302, `callback status ${callback.status}`)
  assert(jar.cookies.has("authjs.session-token"), "session cookie set")
  const session = await (
    await fetch(`${AUTHJS}/api/auth/session`, { headers: { Cookie: jar.header() } })
  ).json()
  assert(session?.user?.email === EMAIL, `session ${JSON.stringify(session)}`)
  const page = await (await fetch(`${AUTHJS}/`, { headers: { Cookie: jar.header() } })).text()
  assert(page.includes(`Signed in as ${EMAIL}`), "home page shows the signed-in user")
  return { send, link, session }
}

async function betterAuth() {
  await resetStub()
  const jar = new Jar()
  const signIn = await fetch(`${BETTER_AUTH}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BETTER_AUTH },
    body: JSON.stringify({ email: EMAIL, callbackURL: "/" }),
  })
  const result = await signIn.json()
  assert(signIn.ok && result.status === true, `sign-in ${signIn.status} ${JSON.stringify(result)}`)

  const { send, link } = await oneSend(
    new RegExp(`${BETTER_AUTH}/api/auth/magic-link/verify\\?\\S+`)
  )
  assert(send.body.from.email === "no-reply@example.test", "from address")
  assert(send.body.subject === "Your sign-in link", "subject")

  const verify = await fetch(link, { redirect: "manual" })
  jar.store(verify)
  assert(verify.status === 302, `verify status ${verify.status}`)
  assert(jar.cookies.has("better-auth.session_token"), "session cookie set")
  const session = await (
    await fetch(`${BETTER_AUTH}/api/auth/get-session`, { headers: { Cookie: jar.header() } })
  ).json()
  assert(session?.user?.email === EMAIL, `session ${JSON.stringify(session)}`)
  const page = await (await fetch(`${BETTER_AUTH}/`, { headers: { Cookie: jar.header() } })).text()
  assert(page.includes(`Signed in as ${EMAIL}`), "home page shows the signed-in user")
  return { send, link, session }
}

const results = { startedAt: new Date().toISOString() }
let failed = false
for (const [name, flow] of [["authjs", authjs], ["betterAuth", betterAuth]]) {
  try {
    results[name] = { pass: true, ...(await flow()) }
    console.log(`PASS ${name}: one valid send to ${EMAIL}; sign-in link signs the user in`)
  } catch (error) {
    failed = true
    results[name] = { pass: false, error: String(error) }
    console.log(`FAIL ${name}: ${error}`)
  }
}
writeFileSync(process.env.RESULTS_FILE ?? "e2e-results.json", JSON.stringify(results, null, 2))
process.exit(failed ? 1 : 0)
