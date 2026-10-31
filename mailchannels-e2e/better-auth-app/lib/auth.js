import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { magicLink } from "better-auth/plugins"
import { sendEmail } from "./email"

const db = (globalThis.__mailchannelsE2eDb ??= {
  user: [],
  session: [],
  account: [],
  verification: [],
})

export const auth = betterAuth({
  database: memoryAdapter(db),
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email address",
        text: `Verify your email address: ${url}`,
        html: `<p><a href="${url}">Verify your email address</a></p>`,
      })
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: "Your sign-in link",
          text: `Sign in: ${url}`,
          html: `<p><a href="${url}">Sign in</a></p>`,
        })
      },
    }),
  ],
})
