// In-memory Auth.js adapter for the e2e test only (one `next start` process).
const memory = (globalThis.__mailchannelsE2eMemory ??= {
  users: new Map(),
  accounts: new Map(),
  sessions: new Map(),
  tokens: new Map(),
})

export function MemoryAdapter() {
  return {
    async createUser(user) {
      const created = { ...user, id: crypto.randomUUID() }
      memory.users.set(created.id, created)
      return created
    },
    async getUser(id) {
      return memory.users.get(id) ?? null
    },
    async getUserByEmail(email) {
      for (const user of memory.users.values())
        if (user.email === email) return user
      return null
    },
    async getUserByAccount({ provider, providerAccountId }) {
      const account = memory.accounts.get(`${provider}:${providerAccountId}`)
      return account ? (memory.users.get(account.userId) ?? null) : null
    },
    async updateUser(user) {
      const updated = { ...memory.users.get(user.id), ...user }
      memory.users.set(user.id, updated)
      return updated
    },
    async linkAccount(account) {
      memory.accounts.set(
        `${account.provider}:${account.providerAccountId}`,
        account
      )
      return account
    },
    async createSession(session) {
      memory.sessions.set(session.sessionToken, session)
      return session
    },
    async getSessionAndUser(sessionToken) {
      const session = memory.sessions.get(sessionToken)
      if (!session) return null
      return { session, user: memory.users.get(session.userId) }
    },
    async updateSession(session) {
      const updated = { ...memory.sessions.get(session.sessionToken), ...session }
      memory.sessions.set(session.sessionToken, updated)
      return updated
    },
    async deleteSession(sessionToken) {
      memory.sessions.delete(sessionToken)
    },
    async createVerificationToken(token) {
      memory.tokens.set(`${token.identifier}:${token.token}`, token)
      return token
    },
    async useVerificationToken({ identifier, token }) {
      const key = `${identifier}:${token}`
      const stored = memory.tokens.get(key) ?? null
      memory.tokens.delete(key)
      return stored
    },
  }
}
