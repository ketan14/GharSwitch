GharSwitch End-to-End (E2E) Happy Flow for QA
Overview
This document defines the "Happy Path" test scenario for QA. It covers the full lifecycle from Tenant creation to Device Control.

Pre-requisites
Environment: Staging/Dev environment deployed.
Accounts: Access to a Super Admin account.
Hardware: One physical device (Pico W/ESP32) OR a running Simulator.
Note: If using a simulator, ensure it is configured with a known Serial Number.
Test Steps
Phase 1: Tenant Creation
Login as Super Admin.
Navigate to Create Tenant.
Input details:
Name: QA Test Home
Plan: Gold
Email: qa-admin@example.com (Use a fresh email or alias)
Verify:
Toast message "Tenant Created Successfully".
User qa-admin exists in Authentication users list.
Phase 2: User Onboarding
Login as qa-admin@example.com (Tenant Admin).
Navigate to Member Management.
Click Invite Member.
Input:
Email: qa-user@example.com
Role: 
User
Verify:
qa-user appears in the member list.
Phase 3: Device Registration
Action: Power on the Device/Simulator.
Observe: Device connects to Wi-Fi.
Login as qa-admin (Tenant Admin).
Navigate to Register Device.
Input:
Device ID: (Get from device Serial logs, e.g., GHAR_123456)
Claim Code: (If applicable, or leave blank if disabled)
Verify:
Device appears in the Device List.
Device Status changes to ONLINE (Green) within 30 seconds.
Phase 4: Access Assignment
Action (as Tenant Admin):
Go to Member Management.
Select qa-user.
Assign GHAR_123456 to this user.
Verify:
Save confirmation message.
Phase 5: Device Control (The Result)
Login as qa-user (End User).
Verify: Dashboard shows 1 Device Card (GHAR_123456).
Action: Click the Toggle Switch.
Observe:
UI Switch animates.
(Physical/Simulated) Device Relay clicks/logs "RELAY ON".
UI State persists after page refresh.
success Criteria
ALL steps completed without console errors.
Device physically responded to the User's command.
