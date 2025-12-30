# Deployment Guide for GharSwitch Pro

**Project ID**: `gharswitch`
**Architecture**: Monorepo (Single Frontend Portal + Backend Core)

## 1. One-Command Deployment
Yes! You can deploy **everything** (Frontend, Backend, Database Rules) with a single command from the root directory:

```bash
firebase deploy
```

## 2. What this command does
1.  **Builds Backend**: Automatically runs `npm run build` in `backend/firebase/functions` to compile TypeScript.
2.  **Uploads Functions**: Deploys the compiled Cloud Functions.
3.  **Uploads Rules**: Deploys `firestore.rules` and `rtdb.rules.json`.
4.  **Deploys Frontend**: Uploads the `apps/web-portal` Next.js application to Firebase Hosting.

## 3. Environment Setup (Completed)
I have already configured your environment:
*   `apps/web-portal/.env.local` is populated with your keys.
*   `.firebaserc` is set to `gharswitch`.

## 4. Verification
After deployment, your app will be live at:
*   `https://gharswitch.web.app` (or `/user`, `/admin`)
