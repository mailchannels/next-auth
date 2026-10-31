/**
 * <div class="provider" style={{backgroundColor: "#000", display: "flex", justifyContent: "space-between", color: "#fff", padding: 16}}>
 * <span>Built-in <b>MailChannels</b> integration.</span>
 * <a href="https://www.mailchannels.com">
 *   <img style={{display: "block"}} src="https://authjs.dev/img/providers/mailchannels.svg" height="48" width="48"/>
 * </a>
 * </div>
 *
 * @module providers/mailchannels
 */
import type { EmailConfig, EmailUserConfig } from "./index.js"
import { html, text } from "../lib/utils/email.js"

export interface MailChannelsUserConfig extends EmailUserConfig {
  /**
   * The base URL of the MailChannels Email API.
   *
   * @default "https://api.mailchannels.net"
   */
  baseUrl?: string
}

/**
 * Parses an address such as `"Auth.js <no-reply@authjs.dev>"` or
 * `"no-reply@authjs.dev"` into the shape the MailChannels Email API expects.
 */
export function parseAddress(address: string): {
  email: string
  name?: string
} {
  const match = address.match(/^\s*(?:"?([^"<]*?)"?\s*)<([^<>\s]+)>\s*$/)
  if (!match) return { email: address.trim() }
  const [, name, email] = match
  return name ? { email, name } : { email }
}

/**
 * Add MailChannels login to your page.
 *
 * Users sign in with a "magic link" sent through the
 * [MailChannels Email API](https://docs.mailchannels.com/email-api).
 *
 * ### Setup
 *
 * Create an API key in the
 * [MailChannels Console](https://console.mailchannels.net)
 * and set it as `AUTH_MAILCHANNELS_KEY`. The domain of the `from` address needs a
 * [Domain Lockdown](https://docs.mailchannels.com/email-api/domain-lockdown) record.
 *
 * ```ts
 * import { Auth } from "@auth/core"
 * import MailChannels from "@auth/core/providers/mailchannels"
 *
 * const request = new Request(origin)
 * const response = await Auth(request, {
 *   providers: [MailChannels({ from: "Auth.js <no-reply@example.com>" })],
 * })
 * ```
 *
 * ### Resources
 *
 * - [MailChannels Email API documentation](https://docs.mailchannels.com/email-api)
 * - [Auth.js email provider guide](https://authjs.dev/getting-started/authentication/email)
 */
export default function MailChannels(
  config: MailChannelsUserConfig
): EmailConfig {
  return {
    id: "mailchannels",
    type: "email",
    name: "MailChannels",
    from: "Auth.js <no-reply@authjs.dev>",
    maxAge: 24 * 60 * 60,
    async sendVerificationRequest(params) {
      const { identifier: to, provider, url, theme } = params
      const { host } = new URL(url)
      if (!provider.apiKey) throw new TypeError("Missing MailChannels API Key")
      if (!provider.from)
        throw new TypeError("Missing MailChannels from address")
      const baseUrl = (
        (provider as MailChannelsUserConfig).baseUrl ??
        "https://api.mailchannels.net"
      ).replace(/\/+$/, "")
      const res = await fetch(`${baseUrl}/tx/v1/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": provider.apiKey,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: parseAddress(provider.from),
          subject: `Sign in to ${host}`,
          content: [
            { type: "text/plain", value: text({ url, host }) },
            { type: "text/html", value: html({ url, host, theme }) },
          ],
        }),
      })

      if (!res.ok) throw new Error("MailChannels error: " + (await res.text()))
    },
    options: config,
  }
}
