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

## Roadmap (Phase 2)

- [x] Auth gate (Google sign-in, email allowlist)
- [ ] Firestore data model + security rules (lock data to the owner)
- [ ] First integration: Gmail → Email Intelligence (real inbox + AI categories)
- [ ] Then: Zoom/Meet, social, SDR agent
