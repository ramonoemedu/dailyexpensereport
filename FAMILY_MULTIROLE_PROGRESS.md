# Family & Multi-Role Implementation Progress

> **Note:** This checklist provides the step-by-step actionable plan for implementing multi-family, multi-role, and admin features safely and cost-effectively.

## Step-by-Step Checklist

- [ ] **0. Verify Existing Data**
    - [ ] Review and export all existing users in `system_users`
    - [ ] Review and export all existing expenses
    - [ ] Map each user and expense to the new family structure
    - [ ] Review and export all existing settings (income types, expense types, etc.)
    - [ ] Map each setting to the correct family context

- [ ] **0.1. Prepare for Production Migration**
    - [ ] Generate and securely store `serviceAccountKey.json` from Firebase Console (required for backup/restore scripts)
    - [ ] Backup production Firestore data using a custom Node.js script (no billing required)
    - [ ] Test backup restore process with the script (optional but recommended)
    - [ ] Announce planned maintenance/migration window to users (optional)

- [ ] **1. Design Data Structure (Optimized)**
    - [x] Review current collections (`system_users`, `expenses`, etc.)
    - [ ] Plan new structure: `families/{familyId}/members/{uid}`, `families/{familyId}/expenses/{expenseId}`
    - [ ] **Upgrade:** Add `families` map to `system_users/{uid}` to allow 1-read fetch of all user's families on login.
    - [ ] **Upgrade:** Plan consolidated per-family settings: `families/{familyId}/settings/config` (combines all setting types into one doc to save read costs).

- [ ] **2. Migrate Data (Using Batched Writes)**
    - [ ] Create `families` collection for each family
    - [ ] For each user, assign to a family (create new family if needed)
    - [ ] For each user, create a `member` doc in the correct family with their role
    - [ ] **Upgrade:** Update `system_users/{uid}` to include the `families` mapping object.
    - [ ] For each expense, move/copy to the correct `families/{familyId}/expenses/{expenseId}`
    - [ ] **Upgrade:** Migrate and consolidate per-family settings into the single `families/{familyId}/settings/config` document.
    - [ ] Write a Node.js migration script to automate the above steps using **Firestore Batched Writes** (to prevent orphaned data).
    - [ ] Create a shell script to run the migration script if needed
    - [ ] Run the migration script locally/staging first
    - [ ] Verify migrated data for accuracy and completeness

- [ ] **2.1. Migrate Production Data**
    - [ ] Run migration script on production database
    - [ ] Update production Firestore security rules
    - [ ] Test production app with real users
    - [ ] Monitor and verify data and access in production
    - [ ] Announce and go live after confirming success

- [ ] **3. Update Security Rules (Patched)**
    - [ ] Write and test rules for per-family, per-role access
    - [ ] Ensure only admins can manage members and settings
    - [ ] Ensure only editors/admins can write expenses
    - [ ] Ensure only family members can read expenses and settings
    - [ ] Ensure users in Family A cannot view data in Family B
    - [ ] **Security Patch:** Ensure users can read their *own* member doc (so the UI loads), but prevent role escalation (cannot upgrade themselves to admin).

- [ ] **4. Update App Logic & UI**
    - [ ] **Upgrade:** On login, fetch ONLY `system_users/{uid}` and parse the `families` map to know family access.
    - [ ] Show family selector if user has multiple families
    - [ ] Fetch user role for selected family (from the `members` subcollection)
    - [ ] Update all queries to fetch data by user ID and family context
    - [ ] **Upgrade:** Update all settings queries to fetch from the single `settings/config` doc.
    - [ ] Render UI based on role (admin/editor/viewer)
    - [ ] **Upgrade:** Implement an "Invitation Flow" (link, code, or Cloud Function) for admins to add users, rather than trying to create Auth accounts client-side.
    - [ ] Add UI for managing consolidated per-family settings (income types, expense types, balance, banks, etc.)
    - [ ] Ensure users in one family cannot see data/settings of another family
    - [ ] Test UI for correct access and features by role and family

- [ ] **5. Test & Review**
    - [ ] Test with multiple users, families, and roles
    - [ ] Review security rules for leaks (e.g., Viewer trying to write to settings)
    - [ ] Review UI for correct access and features
    - [ ] Test the user invitation flow end-to-end

- [ ] **6. Best Practices**
    - [ ] Document structure and rules for future devs
    - [ ] Regularly review and test security rules

---

Update this file as you complete each step. This checklist will help you track and verify your progress for a secure, scalable, and flexible family/multi-role system.