# Deliverable 1: High-Level Architecture Design

## A. Core Philosophy: Zero-Trust SaaS (Non-Negotiable)

This architecture operates on a **Hostile Environment** assumption. We trust nothing but our own backend code.

### The 4 Security Invariants
1.  **Invariant 1**: Web clients (frontend) are **NOT trusted**. They are treated as potentially malicious actors.
2.  **Invariant 2**: IoT devices are **NOT trusted**. They can be spoofed, stolen, or hacked.
3.  **Invariant 3**: **Cloud Functions** are the sole authority for enforcing subscriptions, quotas, and command authorization.
4.  **Invariant 4**: **Firestore** is the Source of Truth. **RTDB** is a dumb transport layer.

If any of these are violated, the system is compromised.

---

## B. Technology Stack & Roles

| Component | Technology | Role | Allowed | NOT Allowed | WHY? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication** | **Firebase Auth** | Identity Provider | Verify identity, Issue Custom Claims (`tenantId`, `role`). | Store user profile data, Manage subscriptions. | Native integration with Google, stateless verification in rules via Claims. |
| **Source of Truth** | **Cloud Firestore** | The Database / Authority | Store configurations, relationships, RBAC policies, usage counters. | Store high-frequency live state (latency/cost prohibitive). | Strong consistency, powerful querying, robust security rules for complex relationships. |
| **Live State** | **Realtime DB (RTDB)** | Transport / Nervous System | Store `device_states` (ON/OFF), `device_commands`, `online_status`. | Store persistent config, user data, or historical logs. | Sub-millisecond latency, presence features, massive throughput for simple key-value pairs. |
| **Enforcement** | **Cloud Functions** | The Enforcer | **Everything.** Validate business rules, check quotas, authorize commands, write to RTDB `commands`. | Be bypassed by the frontend. | It is the *only* secure environment where we can run trusted code. |
| **Frontend** | **Next.js** | The View | Display data the backend allows it to see. | Write to critical paths, enforce logic, assume it knows the "truth". | React/Next.js is client-side; anything in the browser can be manipulated. |

---

## C. Separation of Concerns (MANDATORY)

### Firestore = SOURCE OF TRUTH
Firestore holds the "Legal" state of the world.
*   **Configuration**: What is a "Bronze" plan? What is a "4-channel" device?
*   **Ownership**: Which Tenant owns Device X? Which User belongs to Tenant Y?
*   **Relationships**: User -> Tenant -> Subscription.
*   **RBAC**: Who is an Admin vs Standard User.
*   **Tenant Isolation**: The hard boundaries between customers.

### RTDB = LIVE STATE ONLY
RTDB holds the "Physical" state of the world.
*   `device_states/{deviceId}`: The current reported state (ON/OFF).
*   `device_commands/{deviceId}`: Pending commands waiting for device pickup.
*   `device_status/{deviceId}`: Online/Offline presence.

### 🛑 What RTDB Must NEVER Store
*   **User Profiles**: Insecure, hard to query.
*   **Subscription Data**: Cannot easily enforce complex rules.
*   **Audit Logs**: RTDB is ephemeral-ish; no long-term reliability guarantees for logs.

**Why mixing is dangerous**: Using RTDB for config leads to "Rule Spaghetti" where security logic is mixed with high-frequency data rules, increasing the risk of accidental exposure.

---

## D. Multi-Tenancy & Isolation Strategy

Isolation is enforced at the **Storage Layer** using **Tenant IDs**.

### The Mechanism
1.  **Stamping**: Every document (Device, User) has a `tenantId` field.
2.  **Claims**: The User's Auth Token has a `{ tenantId: "xyz" }` claim.
3.  **Enforcement**: Firestore Security Rules strictly compare request vs resource.
    ```
    allow read: if resource.data.tenantId == request.auth.token.tenantId;
    ```

**Invariant**: If `tenantId` does not match, the database physically refuses the read/write. The frontend cannot "forget" to filter data; the backend ensures it never leaves the server.

---

## E. IoT Cloud Contract (Hostile Client Model)

Devices are dumb executors. They do not decide *if* they should turn on; they only listen.

### The Authoritative Command Flow
1.  **User Intent**: User clicks "Turn ON" in the Dashboard.
2.  **Request**: Frontend calls `executeSwitchCommand(deviceId, switchIndex, state)`.
3.  **Validation (Cloud Function)**:
    *   Auth Check: Is user logged in?
    *   Tenant Check: Does `user.tenantId` == `device.tenantId`?
    *   Quota Check: Has tenant exceeded 500 req/day?
    *   Capability Check: Is `switchIndex` valid for this hardware model?
4.  **Authorization**: If ALL pass, Cloud Function prevents concurrent writes and writes to RTDB `commands/{deviceId}`.
5.  **Execution**: Device (listening to RTDB) picks up command. Toggles relay.
6.  **Confirmation**: Device writes new status to RTDB `device_states/{deviceId}`.

---

## F. Why Monorepo Is REQUIRED

1.  **Shared Domain Types**: The `SwitchCommand` interface used in the Cloud Function MUST be bitwise identical to the one used in the Next.js Admin Panel and the Device Simulator.
2.  **Atomic Deploys**: A change to the Firestore `User` schema requires simultaneous updates to:
    *   Security Rules (validation)
    *   Cloud Functions (business logic)
    *   Frontend (UI)
    *   If these drift, the system breaks or becomes insecure.
3.  **Single Source of Truth**: One `validators` package ensures the frontend doesn't allow a password that the backend rejects.

---

**Approve architecture before proceeding?**
