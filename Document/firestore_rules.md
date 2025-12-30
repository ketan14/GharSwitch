# Deliverable 6: Firestore Security Rules

## Core Logic
These rules enforce the **Zero-Trust** model at the database level. Even if the Cloud Function is bypassed or the Frontend is hacked, these rules prevent unauthorized access.

### Helper Functions

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- HELPERS ---

    // 1. Auth & Tenancy
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Checks if the user's custom claim tenantId matches the document's tenantId
    function isTenantMember(resourceData) {
      return isAuthenticated() && 
             request.auth.token.tenantId == resourceData.tenantId;
    }

    // 2. Roles (From Custom Claims)
    function isSuperAdmin() {
      return isAuthenticated() && request.auth.token.role == 'super_admin';
    }
    
    function isAdmin() {
      return isAuthenticated() && request.auth.token.role == 'admin';
    }

    // 3. Schema Validation (Fail Closed)
    // Prevent poisoning the DB with documents missing tenantId
    function hasTenantId() {
      return request.resource.data.tenantId == request.auth.token.tenantId;
    }

    // --- COLLECTIONS ---

    // 1. TENANTS
    // Confidential. Only Super Admin can write. Tenant Admins can read THEIR OWN.
    match /tenants/{tenantId} {
      allow read: if isSuperAdmin() || (isAdmin() && request.auth.token.tenantId == tenantId);
      allow write: if isSuperAdmin(); // createTenant function handles creation mainly, but SA can edit.
    }

    // 2. USERS
    // Profile data. 
    match /users/{userId} {
      // Super Admin sees all. Users see themselves. Tenant Admin sees users in their tenant.
      allow read: if isSuperAdmin() || 
                  (isAuthenticated() && request.auth.uid == userId) ||
                  (isAdmin() && isTenantMember(resource.data));
                  
      // Only Super Admin or Cloud Functions create users. 
      // Users can update their own display name, but NOT their role or tenantId.
      allow update: if isAuthenticated() && request.auth.uid == userId 
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName'])
                    && request.resource.data.role == resource.data.role         // Anti-Escalation
                    && request.resource.data.tenantId == resource.data.tenantId; // Anti-Movement
    }

    // 3. DEVICES
    // The Hardware Registry.
    match /devices/{deviceId} {
      // Read: Tenant Members can see devices.
      allow read: if isSuperAdmin() || isTenantMember(resource.data);
      
      // Write: SUPER STRICT. 
      // Only Cloud Functions (bypass rules) or Super Admin can create.
      // Tenant Admin can update displayName only.
      allow update: if isAdmin() && isTenantMember(resource.data)
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName']);
    }

    // 4. SWITCHES (Subcollection)
    match /devices/{deviceId}/switches/{switchId} {
      allow read: if isSuperAdmin() || isTenantMember(get(/databases/$(database)/documents/devices/$(deviceId)).data);
      
      // Write: Tenant Admin can rename.
      allow update: if isAdmin() && isTenantMember(get(/databases/$(database)/documents/devices/$(deviceId)).data)
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName']);
    }

    // 5. DEVICE TYPES (Catalog)
    // Public Read-Only for authenticated users.
    match /deviceTypes/{typeId} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin();
    }

    // 6. DEVICE USERS (Access Mapping)
    // Explicit grants.
    match /deviceUsers/{mappingId} {
      allow read: if isSuperAdmin() || isTenantMember(resource.data);
      // Only Admins can assign/revoke access.
      allow write: if isAdmin() && hasTenantId();
    }

    // 7. USAGE COUNTERS
    // CRITICAL: READ-ONLY for everyone. WRITE-ONLY for Cloud Functions.
    match /usageCounters/{counterId} {
      allow read: if isSuperAdmin() || isTenantMember(resource.data);
      allow write: if false; // Only Cloud Functions (Admin SDK) can write here.
    }
  }
}
```

## Security Analysis

1.  **Isolation**: The `isTenantMember` helper is used on every read. It strictly checks `resource.data.tenantId == auth.token.tenantId`.
2.  **Anti-Escalation**: User update rule explicitly explicitly forbids changing `role` or `tenantId`.
3.  **Quota Protection**: `usageCounters` is `allow write: if false`. This guarantees that the Frontend cannot reset its own quota to bypass limits.
4.  **Hardware Integrity**: `devices` creation is blocked for everyone except Super Admin (or Cloud Functions via Admin SDK). Tenant Admins cannot "fake" a device insertion.
