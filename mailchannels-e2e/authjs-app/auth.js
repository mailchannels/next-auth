import NextAuth from "next-auth"
import MailChannels from "next-auth/providers/mailchannels"
import { MemoryAdapter } from "./lib/memory-adapter"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MemoryAdapter(),
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    MailChannels({
      // AUTH_MAILCHANNELS_KEY is read from the environment.
      from: "E2E Test <no-reply@example.test>",
      baseUrl: process.env.MAILCHANNELS_BASE_URL,
    }),
  ],
})
