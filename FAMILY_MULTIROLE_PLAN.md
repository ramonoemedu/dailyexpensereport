# Family & Multi-Role Firestore Improvement Plan

> **Note:** This plan provides the overall strategy, design, best practices, and a step-by-step actionable checklist for implementing multi-family, multi-role, and admin features.

## 1. Data Structure

- `system_users/{uid}`: User profile info
- `families/{familyId}`: Family info
  - `members/{uid}`: Each member with a `role` (admin/editor/viewer)
  - `expenses/{expenseId}`: Family expenses
  - `settings/{settingType}`: Per-family settings (income types, expense types, balance, banks, etc.)

## 2. Firestore Security Rules

- Only family members can read expenses and settings
- Only editors/admins can write expenses
- Only admins can manage members and settings

Example:
```plaintext
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{familyId}/expenses/{expenseId} {
      allow read: if hasRole(familyId, ['viewer', 'editor', 'admin']);
      allow write: if hasRole(familyId, ['editor', 'admin']);
    }
    match /families/{familyId}/members/{userId} {
      allow read, write: if hasRole(familyId, ['admin']);
    }
    match /families/{familyId}/settings/{settingType} {
      allow read: if hasRole(familyId, ['viewer', 'editor', 'admin']);
      allow write: if hasRole(familyId, ['admin']);
    }
    function hasRole(familyId, roles) {
      return request.auth != null &&
        roles.hasAny([
          get(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid)).data.role
        ]);
    }
  }
}
```

## 3. App Logic & UI

- On login, fetch all families where user is a member
- Show family selector if user has multiple families
- Fetch user role for selected family
- Render UI based on role:
  - **Admin:** View/add/edit/delete expenses, manage members, manage settings
  - **Editor:** View/add/edit expenses
  - **Viewer:** View expenses only
- For admins, provide member management UI (invite, change role, remove)
- For admins, provide settings management UI (income types, expense types, etc.)

## 4. Migration Steps

1. Create `families` collection and move expenses under each family
2. For each user, create a member doc in the correct family with their role
3. Migrate per-family settings to families/{familyId}/settings/{settingType}
4. Update app queries to use the new structure
5. Implement and test new security rules
6. Update UI for family selection, role-based access, and settings management

## 5. Best Practices

- Always enforce access with Firestore rules
- Use subcollections for family-specific data and settings
- Keep user roles per family for flexibility
- Regularly review and test security rules

---

## Step-by-Step Checklist

- [ ] **0. Verify Existing Data**
    - [ ] Review and export all existing users in system_users
    - [ ] Review and export all existing expenses
    - [ ] Map each user and expense to the new family structure
    - [ ] Review and export all existing settings (income types, expense types, etc.)
    - [ ] Map each setting to the correct family context

- [ ] **0.1. Prepare for Production Migration**
    - [ ] Backup production Firestore data using a custom Node.js script (no billing required)
    - [ ] Test backup restore process with the script (optional but recommended)
    - [ ] Announce planned maintenance/migration window to users (optional)

- [ ] **1. Design Data Structure**
    - [x] Review current collections (system_users, expenses, etc.)
    - [ ] Plan new structure: families/{familyId}/members/{uid}, families/{familyId}/expenses/{expenseId}
    - [ ] Plan per-family settings: families/{familyId}/settings/{settingType}

- [ ] **2. Migrate Data**
    - [ ] Create families collection for each family
    - [ ] For each user, assign to a family (create new family if needed)
    - [ ] For each user, create a member doc in the correct family with their role
    - [ ] For each expense, move/copy to the correct families/{familyId}/expenses/{expenseId}
    - [ ] Update system_users to reference family membership if needed
    - [ ] Migrate per-family settings (income types, expense types, etc.) to families/{familyId}/settings/{settingType}
    - [ ] **Write a migration script to automate the above steps**
    - [ ] **Create a shell script to run the migration script if needed**
    - [ ] **Run the migration script using the shell script or directly**
    - [ ] Verify migrated data for accuracy and completeness

- [ ] **2.1. Migrate Production Data**
    - [ ] Run migration script on production database
    - [ ] Update production Firestore security rules
    - [ ] Test production app with real users
    - [ ] Monitor and verify data and access in production
    - [ ] Announce and go live after confirming success

- [ ] **3. Update Security Rules**
    - [ ] Write and test rules for per-family, per-role access
    - [ ] Ensure only admins can manage members and settings
    - [ ] Ensure only editors/admins can write expenses
    - [ ] Ensure only family members can read expenses and settings
    - [ ] Ensure users in Family A cannot view data in Family B
    - [ ] Ensure admins can view/manage all families

- [ ] **4. Update App Logic & UI**
    - [ ] On login, fetch all families for user
    - [ ] Show family selector if user has multiple families
    - [ ] Fetch user role for selected family
    - [ ] Update all queries to fetch data by user ID and family context
    - [ ] Update all settings queries to fetch by family context, not just user
    - [ ] Render UI based on role (admin/editor/viewer)
    - [ ] Add member management UI for admins (invite, assign roles, remove)
    - [ ] Add UI for per-family settings (income types, expense types, balance, banks, etc.)
    - [ ] Allow admin to create users (e.g., hasbank, wife) and assign roles
    - [ ] Allow editors (e.g., wife) to invite/view-only users to their family
    - [ ] Ensure users in one family cannot see data/settings of another family
    - [ ] Ensure admin can view/manage all families and their settings
    - [ ] Test UI for correct access and features by role and family

- [ ] **5. Test & Review**
    - [ ] Test with multiple users, families, and roles
    - [ ] Review security rules for leaks
    - [ ] Review UI for correct access and features

- [ ] **6. Best Practices**
    - [ ] Document structure and rules for future devs
    - [ ] Regularly review and test security rules

---

Update this file as you complete each step. This plan and checklist will help you track and verify your progress for a secure, scalable, and flexible family/multi-role system.
