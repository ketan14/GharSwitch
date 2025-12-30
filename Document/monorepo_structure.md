# Deliverable 2: Monorepo Structure

## Rationale
We utilize a Monorepo design to enforce **Type Safety across boundaries**. The Frontend, Cloud Functions, and IoT Simulators must all agree on what a "Command" looks like.

## Directory Tree

```text
/
├── apps/                          # frontend applications (Next.js)
│   ├── web-user/                  # End-user dashboard (mobile-first)
│   ├── web-admin/                 # Tenant Admin dashboard (management)
│   └── web-super-admin/           # Platform Owner dashboard (deployment/global)
│
├── backend/                       # Backend Logic & Configuration
│   └── firebase/
│       ├── functions/             # Cloud Functions (The Enforcer)
│       ├── firestore.rules        # Security Rules (The source of truth access control)
│       └── rtdb.rules.json        # RTDB Rules (The live state access control)
│
├── iot/                           # Firmware & Device Code
│   ├── esp32/                     # C++ / MicroPython code for ESP32
│   ├── pico/                      # Code for Raspberry Pi Pico W
│   └── python-simulator/          # Reference implementation for testing
│
├── packages/                      # Shared Code (The Glue)
│   ├── domain-types/              # Interfaces shared by ALL (DB, API, frontend)
│   │   ├── src/
│   │   │   ├── user.ts            # User & Role definitions
│   │   │   ├── device.ts          # Device, Switch, Command definitions
│   │   │   └── subscription.ts    # Plan limits and quotas
│   │
│   ├── constants/                 # Shared static values
│   │   ├── src/
│   │   │   ├── limits.ts          # Hardcoded plan limits (Bronze=100, etc.)
│   │   │   └── firebase-paths.ts  # Standardized DB paths
│   │
│   └── validators/                # Shared validation logic
│       ├── src/
│           ├── common.ts          # Email, password regex
│           └── iot-safety.ts      # Command payload validation
│
├── tools/                         # DevOps & Scripts
│   └── seed-data/                 # Scripts to populate initial DB state
│
├── package.json                   # Root workspace config
├── nx.json                        # Monorepo build tool config
└── tsconfig.base.json             # Shared TypeScript configuration
```

## detailed Package Responsibilities

### `packages/domain-types`
*   **Role**: The "Dictionary".
*   **Contains**: purely TypeScript interfaces/types.
*   **Dependency**: 0 dependencies.
*   **Usage**: Imported by Frontend, Cloud Functions, and Device Logic (if JS/Python).

### `packages/constants`
*   **Role**: The "Configuration".
*   **Contains**: Hardcoded values that must be consistent.
*   **Example**: `PLAN_LIMITS.BRONZE.MAX_SWITCHES = 4`.
*   **Usage**: CONSTANTS are used by:
    *   **Cloud Functions**: To enforce limits.
    *   **Frontend**: To show "Upgrade to Silver" UI warnings (Visual only).

### `packages/validators`
*   **Role**: The "Law".
*   **Contains**: Pure functions that return `true` or `false` (or throw errors).
*   **Usage**:
    *   **Cloud Functions**: RUNS these checks to approve/deny requests.
    *   **Frontend**: Runs these checks to provide instant UI feedback (but is NOT trusted).

## Isolation Invariants

1.  **Backend** (`backend/firebase`) depends on `packages/*`.
2.  **Frontend** (`apps/*`) depends on `packages/*`.
3.  **Frontend** must **NEVER** import from `backend/`.
4.  **IoT** code generally creates its own types (C++/MicroPython) but `python-simulator` SHOULD use `domain-types` if possible or manually sync to strict specs.
