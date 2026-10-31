// The sendEmail helper from docs.mailchannels.com (Auth.js and Better Auth
// page), with `baseUrl` set so the e2e test can point it at the stub.
import { MailChannels } from "mailchannels-sdk"

const mailchannels = new MailChannels(process.env.MAILCHANNELS_API_KEY, {
  baseUrl: process.env.MAILCHANNELS_BASE_URL,
})

export async function sendEmail({ to, subject, text, html }) {
  const { error } = await mailchannels.emails.send({
    from: { email: process.env.EMAIL_FROM, name: "E2E Test" },
    to: { email: to },
    subject,
    text,
    html,
  })
  if (error) throw new Error(`MailChannels send failed: ${JSON.stringify(error)}`)
}
