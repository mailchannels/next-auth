// Stub of the MailChannels Email API for tests. It accepts POST /tx/v1/send,
// validates the request the way the real API would at a basic level, and
// records every valid send. GET /sends lists them; DELETE /sends clears them.
import { createServer } from "node:http"
import { randomUUID } from "node:crypto"

const port = Number(process.env.PORT ?? 8080)
const sends = []
const rejected = []

function invalid(body, headers) {
  if (!headers["x-api-key"]) return "missing X-Api-Key header"
  const to = body?.personalizations?.[0]?.to
  if (!Array.isArray(to) || to.length === 0 || !to.every((r) => r?.email))
    return "personalizations[0].to must list recipients with an email"
  if (!body.from?.email) return "from.email is required"
  if (!body.subject) return "subject is required"
  if (
    !Array.isArray(body.content) ||
    body.content.length === 0 ||
    !body.content.every((c) => c?.type && typeof c.value === "string")
  )
    return "content must be a list of { type, value }"
  return null
}

function json(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(value))
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://stub")
  if (url.pathname === "/sends" && req.method === "GET")
    return json(res, 200, { sends, rejected })
  if (url.pathname === "/sends" && req.method === "DELETE") {
    sends.length = 0
    rejected.length = 0
    return json(res, 204, {})
  }
  if (url.pathname === "/tx/v1/send" && req.method === "POST") {
    let raw = ""
    for await (const chunk of req) raw += chunk
    let body
    try {
      body = JSON.parse(raw)
    } catch {
      rejected.push({ reason: "invalid JSON", raw })
      return json(res, 400, { errors: ["invalid JSON"] })
    }
    const reason = invalid(body, req.headers)
    if (reason) {
      rejected.push({ reason, body })
      return json(res, 400, { errors: [reason] })
    }
    const messageId = randomUUID()
    sends.push({
      receivedAt: new Date().toISOString(),
      apiKey: req.headers["x-api-key"],
      userAgent: req.headers["user-agent"] ?? null,
      body,
    })
    return json(res, 202, {
      request_id: randomUUID(),
      results: [{ index: 0, message_id: messageId, status: "sent" }],
    })
  }
  json(res, 404, { errors: ["not found"] })
}).listen(port, () => console.log(`stub Email API listening on ${port}`))
