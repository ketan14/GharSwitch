# Deliverable 3: Cloud Firestore Schema (Source of Truth)

## Core Invariants
1.  **Isolation**: Every document MUST contain `tenantId` (except `deviceTypes`).
2.  **Validation**: No frontend can write to `devices` or `subscriptions`.
3.  **Timestamps**: All documents track `createdAt` / `updatedAt` for audit.

## Collection Structure

### 1. `tenants`
**Scope**: Private implementation details of a customer.
*   **ID**: UUID (or alphanumeric string).
*   **Write Access**: Super Admin only.
*   **Read Access**: Tenant Admin (own doc only).

```typescript
interface Tenant {
  id: string;                 // "tnt_123"
  name: string;               // "Acme Corp"
  planId: "bronze" | "silver" | "gold";
  subscriptionStatus: "active" | "past_due" | "canceled";
  maxDevices: number;         // Denormalized from Plan
  maxUsers: number;
  createdAt: Timestamp;
}
```

### 2. `users`
**Scope**: Individual credentials and profile.
*   **ID**: Firebase Auth UID.
*   **Write Access**: Super Admin (create), Admin (create within tenant), User (update self profile only).

```typescript
interface User {
  uid: string;
  email: string;
  displayName: string;
  role: "super_admin" | "admin" | "user";
  tenantId: string;           // CRITICAL: Links user to tenant
  disabled: boolean;          // Kill switch
  createdAt: Timestamp;
}
```

### 3. `devices` (The Registry)
**Scope**: Physical units deployed in the field.
*   **ID**: Serial Number / MAC Address (hardware immutable ID).
*   **Write Access**: Super Admin (provisioning only). Admin (assigning name/metadata).

```typescript
interface Device {
  id: string;                 // "dev_ESP32_A1B2"
  tenantId: string;           // Owner
  typeId: "basic_4ch" | "standard_8ch" | "pro_16ch";
  displayName: string;        // "Living Room Board"
  secretKeyHash: string;      // For device auth (never plain text)
  firmwareVersion: string;
  isOnline: boolean;          // Updated via Cloud Function on disconnect
  createdAt: Timestamp;
}
```

### 4. `switches` (Sub-collection)
**Path**: `devices/{deviceId}/switches/{switchId}`
**Scope**: Logical channels on a device.
*   **ID**: Index (e.g., "0", "1", "2").
*   **Write Access**: Backend Only (Creation). User (Renaming).

```typescript
interface Switch {
  id: string;                 // "0"
  index: number;              // 0
  deviceId: string;
  tenantId: string;           // Redundant but required for Collection Group queries
  displayName: string;        // "Ceiling Fan"
  type: "toggle" | "dimmer" | "fan"; // Capability hint
}
```

### 5. `deviceTypes` (Global Catalog)
**Scope**: Platform definitions. Read-only for everyone.
*   **ID**: "basic_4ch", etc.

```typescript
interface DeviceType {
  id: string;
  name: string;               // "Basic 4-Channel"
  channelCount: number;       // 4
  capabilities: string[];     // ["on_off"]
  planTier: "bronze" | "silver" | "gold"; // Minimum plan required
}
```

### 6. `deviceUsers` (Access Control Mapping)
**Scope**: Who can control what.
*   **ID**: Composite `${deviceId}_${userId}`.
*   **Write Access**: Admin only.

```typescript
interface DeviceUser {
  id: string;                 // "dev_123_user_456"
  tenantId: string;
  deviceId: string;
  userId: string;
  role: "owner" | "viewer";   // Future proofing
  allowedSwitches: number[];  // [0, 1, 2, 3] (Empty = All for MVP, but schema exists)
  createdAt: Timestamp;
}
```

### 7. `usageCounters` (Quota Tracking)
**Scope**: Daily request counting.
*   **ID**: Composite `${tenantId}_${YYYY-MM-DD}`.
*   **Write Access**: Cloud Functions ONLY.

```typescript
interface DailyUsage {
  id: string;                 // "tnt_123_2023-10-27"
  tenantId: string;
  date: string;               // "2023-10-27"
  requestCount: number;       // 150
  limit: number;              // 100 (Snapshot from Plan at start of day)
}
```

## Security Invariants Check

*   **Tenant Isolation**: Every `User`, `Device`, `Switch`, `DeviceUser` has `tenantId`. A single Firestore rule `resource.data.tenantId == request.auth.token.tenantId` covers 90% of checks.
*   **Quota Enforcement**: `usageCounters` is writable ONLY by Cloud Functions. Frontend cannot reset its own limits.
*   **Device Spoofing**: Devices are provisioned primarily by Super Admin. Device Auth uses `secretKeyHash` validated by Cloud Functions, not public read.
*   **Switch Access**: `deviceUsers` table explicitly grants permission. If a record doesn't exist here, the Cloud Function denies the command.
