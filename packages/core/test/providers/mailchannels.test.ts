import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import MailChannels, { parseAddress } from "../../src/providers/mailchannels"
import { setEnvDefaults } from "../../src/lib/utils/env"
import type { AuthConfig } from "../../src"
import type { EmailConfig } from "../../src/providers"

const url = "https://example.test/api/auth/callback/mailchannels?token=abc"

function sendParams(provider: EmailConfig) {
  return {
    identifier: "user@example.test",
    url,
    expires: new Date(),
    provider,
    token: "abc",
    theme: { brandColor: "#123456" },
    request: new Request("https://example.test"),
  }
}

/** Mirrors how Auth.js merges the user config into the provider defaults. */
function resolve(config: Parameters<typeof MailChannels>[0]): EmailConfig {
  const provider = MailChannels(config)
  return { ...provider, ...provider.options } as EmailConfig
}

describe("MailChannels provider", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }))
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("has email provider defaults", () => {
    const provider = MailChannels({})
    expect(provider.id).toBe("mailchannels")
    expect(provider.name).toBe("MailChannels")
    expect(provider.type).toBe("email")
    expect(provider.from).toBe("Auth.js <no-reply@authjs.dev>")
    expect(provider.maxAge).toBe(24 * 60 * 60)
  })

  it("sends the sign-in link through the Email API", async () => {
    const provider = resolve({
      apiKey: "test-key",
      from: "Example <no-reply@example.test>",
    })
    await provider.sendVerificationRequest(sendParams(provider))

    expect(fetchMock).toHaveBeenCalledOnce()
    const [endpoint, init] = fetchMock.mock.calls[0]
    expect(endpoint).toBe("https://api.mailchannels.net/tx/v1/send")
    expect(init.method).toBe("POST")
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      "X-Api-Key": "test-key",
    })
    const body = JSON.parse(init.body)
    expect(body.personalizations).toEqual([
      { to: [{ email: "user@example.test" }] },
    ])
    expect(body.from).toEqual({
      email: "no-reply@example.test",
      name: "Example",
    })
    expect(body.subject).toBe("Sign in to example.test")
    expect(body.content.map((c: { type: string }) => c.type)).toEqual([
      "text/plain",
      "text/html",
    ])
    expect(body.content[0].value).toContain(url)
    expect(body.content[1].value).toContain(`href="${url}"`)
    expect(body.content[1].value).toContain("#123456")
  })

  it("uses a custom baseUrl", async () => {
    const provider = resolve({
      apiKey: "test-key",
      baseUrl: "http://localhost:8080/",
    })
    await provider.sendVerificationRequest(sendParams(provider))
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8080/tx/v1/send")
  })

  it("throws when the API key is missing", async () => {
    const provider = resolve({})
    await expect(
      provider.sendVerificationRequest(sendParams(provider))
    ).rejects.toThrow("Missing MailChannels API Key")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("throws the API error on a failed send", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"errors":["Domain Lockdown check failed"]}', {
        status: 403,
      })
    )
    const provider = resolve({ apiKey: "test-key" })
    await expect(
      provider.sendVerificationRequest(sendParams(provider))
    ).rejects.toThrow(
      'MailChannels error: {"errors":["Domain Lockdown check failed"]}'
    )
  })

  it("reads the API key from AUTH_MAILCHANNELS_KEY", () => {
    const config: AuthConfig = { providers: [MailChannels({})] }
    setEnvDefaults({ AUTH_MAILCHANNELS_KEY: "env-key" }, config)
    expect((config.providers[0] as EmailConfig).apiKey).toBe("env-key")
  })
})

describe("parseAddress", () => {
  it.each([
    ["no-reply@example.test", { email: "no-reply@example.test" }],
    [" no-reply@example.test ", { email: "no-reply@example.test" }],
    ["<no-reply@example.test>", { email: "no-reply@example.test" }],
    [
      "Auth.js <no-reply@example.test>",
      { email: "no-reply@example.test", name: "Auth.js" },
    ],
    [
      '"Example, Inc." <no-reply@example.test>',
      { email: "no-reply@example.test", name: "Example, Inc." },
    ],
  ])("parses %j", (input, expected) => {
    expect(parseAddress(input)).toEqual(expected)
  })
})
