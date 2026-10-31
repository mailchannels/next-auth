# MailChannels e2e (MailChannels fork only, not for upstream)

Checks the MailChannels Auth.js provider (`agent/overlord-32/mailchannels-provider`)
and the Better Auth integration from
[docs.mailchannels.com](https://docs.mailchannels.com/email-api/integrations/auth-libraries)
against a stub of the MailChannels Email API. Synthetic data only.

`ci.sh` (run from the repository root, Node LTS):

1. builds and tests `@auth/core`;
2. packs `@auth/core` and `next-auth` and installs them in `authjs-app`, a
   Next.js app that uses `next-auth/providers/mailchannels`;
3. installs `better-auth-app`, a Next.js app that uses Better Auth's magic-link
   plugin with the `mailchannels-sdk` helper;
4. starts `stub/server.mjs` on port 8080 and both apps (3001, 3002), then runs
   `run-e2e.mjs`: for each app it requests a magic link for
   `user@example.test`, expects exactly one valid send at the stub containing
   the sign-in URL, follows the link and expects a session for that user.

Results and logs are written to `mailchannels-e2e/out/`. The
`MailChannels e2e` workflow runs the same script on every `agent/**` push.
