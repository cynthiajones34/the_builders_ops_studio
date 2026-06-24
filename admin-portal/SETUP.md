# Command Center — setup & operations

Admin portal for the BOS site. Built with Vite + React + TypeScript + Tailwind.
Source lives in `admin-portal/`, builds to `admin/` at the repo root, and is
served by Firebase Hosting at `/admin`.

## Local development

```bash
cd admin-portal
npm install
npm run dev      # http://localhost:5173/admin/
npm run build    # outputs to ../admin
```

## Firebase project

- Project: `the-builders-ops-studio` (already exists)
- Web app config is in `src/lib/firebase.ts` (public; not a secret)

### One-time: enable Google sign-in (required for login)

1. Firebase console → **Authentication** → **Get started** (if first time).
2. **Sign-in method** tab → **Add new provider** → **Google** → toggle **Enable**.
3. Set the project support email → **Save**.

`localhost` is an authorized domain by default. When the portal goes live,
add `thebuildersopsstudio.com` under Authentication → Settings → Authorized
domains. (`*.firebaseapp.com` and `*.web.app` are added automatically.)

### Authorized accounts

Only the emails in `ALLOWED_EMAILS` (`src/lib/firebase.ts`) can use the portal:

- cynthia@thebuildersopsstudio.com
- cynthiajones34@gmail.com

Anyone else who signs in is rejected and signed back out.

## Gmail → Email Intelligence (one-time OAuth setup)

The Gmail API is already enabled on the project. To finish the connection,
create one OAuth client in Google Cloud (console-only step):

1. **OAuth consent screen** (APIs & Services → OAuth consent screen): User type
   **External**. Add both accounts under **Test users**:
   `cynthia@thebuildersopsstudio.com`, `cynthiajones34@gmail.com`.
   (Testing mode is fine for personal use; no Google verification needed.)
2. **Credentials → Create credentials → OAuth client ID → Web application.**
   Under **Authorized redirect URIs** add exactly:
   `https://us-central1-the-builders-ops-studio.cloudfunctions.net/gmailOauthCallback`
3. Copy the **Client ID** and **Client secret**, then store them as function
   secrets and deploy:
   ```bash
   firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_ID
   firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_SECRET
   firebase deploy --only functions
   ```

Then in the portal: **Email Intelligence → Connect Gmail** → consent → it
auto-syncs. Access is **read-only**; nothing is ever sent or deleted.

## Roadmap (Phase 2)

- [x] Auth gate (Google sign-in, email allowlist)
- [x] Firestore data model + security rules (lock data to the owner)
- [~] First integration: Gmail → Email Intelligence (code + rules done; live
      after the OAuth client above is created)
- [ ] Then: Zoom/Meet, social, SDR agent
