# Scaffolding Walkthrough

## Summary
We have successfully **Designed** and **Scaffolds** the GharSwitch Pro platform, strictly adhering to the **Zero-Trust** architecture.

## 1. Monorepo Structure
The project is rooted in `/Users/ketan/GharSwitch-Pro/GharSwitch` with NPM Workspaces.

| Path | Purpose | Status |
| :--- | :--- | :--- |
| `packages/domain-types` | Shared TypeScript Interfaces | ✅ Scaffolded |
| `packages/constants` | Plan Limits & DB Paths | ✅ Scaffolded |
| `packages/validators` | Shared Input Validation | ✅ Scaffolded |
| `backend/firebase` | Firestore/RTDB Rules | ✅ Implemented |
| `backend/functions` | Cloud Functions (Logic) | ✅ Implemented |
| `apps/web-user` | End User Dashboard | ✅ Scaffolded |
| `apps/web-admin` | Tenant Admin Dashboard | ✅ Scaffolded |
| `apps/web-super-admin` | Platform Owner Dashboard | ✅ Scaffolded |
| `iot/python-simulator` | Hostile Client Simulator | ✅ Scaffolded |

## 2. Key Security Implementations

### A. Firestore Rules (`backend/firebase/firestore.rules`)
*   **Isolation**: Every read checks `isTenantMember()`.
*   **Write Block**: Frontend cannot write to `usageCounters` or `devices` (except rename).

### B. Cloud Functions (`backend/firebase/functions/src/index.ts`)
*   **`createTenant`**: Enforces specific Plans (Bronze/Silver/Gold) and stamps `tenantId` claim.
*   **`onDeviceCreated`**: Translates `DeviceType` (4ch vs 8ch) into logical switches.
*   **`executeSwitchCommand`**: 7-Step validation pipeline.
    1.  Auth Check
    2.  Payload Validation
    3.  Device Existence
    4.  **Tenant Isolation Check**
    5.  RBAC Check
    6.  **Quota Check** (Firestore Counter)
    7.  Capability Check (Switch Index vs Hardware)

### C. RTDB Rules (`backend/firebase/rtdb.rules.json`)
*   **Dumb Pipe**: Frontend access is Read-Only.
*   **Isolation**: Reads require `auth.token.tenantId === data.val().tenantId`.

## 3. Next Steps (Implementation)
1.  **Environment Setup**: Run `npm install` (requires fixing local Node/NPM environment).
2.  **Firebase Deploy**: Deploy rules and functions.
3.  **Frontend Logic**: Connect the Next.js apps to the Firebase SDK using the `constants` package.
