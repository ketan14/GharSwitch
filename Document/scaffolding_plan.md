# Phase 2: Scaffolding & Implementation Plan

With the Architecture (Phase 1) approved, we move to **Phase 2: Scaffolding**.
We will execute this in layers, ensuring dependencies (`packages/`) are built before consumers (`apps/`, `backend/`).

## Execution Order

### 1. Monorepo Foundation
*   Initialize root `package.json` (Workspaces).
*   Setup `tsconfig.base.json` (Shared Types).
*   Setup standard `dev-scripts` (ESLint/Prettier).

### 2. Shared Packages (The Glue)
*   **`packages/constants`**: Implement `PLAN_LIMITS`, `FIREBASE_PATHS`.
*   **`packages/domain-types`**: Implement interfaces from Deliverable 3 & 4.
*   **`packages/validators`**: Implement `validateCommand(cmd)` logic.

### 3. Backend Core (The Authority)
*   Initialize `backend/firebase`.
*   Apply `firestore.rules` (from Deliverable 6).
*   Apply `rtdb.rules.json` (from Deliverable 7).
*   Setup `backend/firebase/functions` structure.

### 4. Cloud Functions Implementation
*   Implement `createTenant` (Reference Deliverable 5).
*   Implement `addSwitchToDevice` (Reference Deliverable 5).
*   Implement `executeSwitchCommand` (Reference Deliverable 5).

### 5. Frontend Base (The Clients)
*   Initialize `apps/web-user` (Next.js).
*   Initialize `apps/web-admin` (Next.js).
*   Initialize `apps/web-super-admin` (Next.js).
*   Connect them to local Shared Packages.

### 6. IoT Simulator (Verification)
*   Create `iot/python-simulator`.
*   Implement "Hostile Client" logic to test enforcing rules.

## Validation Gate
At each step, we will verify:
1.  **Compilation**: `npm run build` works for the package.
2.  **Type Safety**: No `any` types in `domain-types`.
3.  **Isolation**: Packages do not leak dependencies.

**Approve this scaffolding plan to begin Step 1.**
