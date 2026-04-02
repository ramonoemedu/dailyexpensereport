# Daily Expense Report

Business and operations guideline for using the system from A to Z.

## 1. What This System Does

This system is a family-based finance platform to manage:

- Daily expenses and incomes
- Bank and cash balances
- Recurring income automation
- Monthly cash and bank reports
- Role-based access for admins and members

Core principle: all data is scoped by family. Each family has isolated settings, balances, and transactions.

## 2. Business Roles

- Admin
	- Full control for the family
	- Manage users, settings, balances, income automation, and data cleanup
- Member
	- Record and view data for their own family
	- Can use daily operation and reports
	- Cannot access admin-only actions

## 3. A to Z Business Flow

### A. Account and Login

1. User logs in from Login page.
2. System resolves user identity and family membership.
3. User role is loaded (admin or member).

Outcome:
- User is inside the correct family workspace.

### B. Base Configuration (one-time per family, usually admin)

1. Set Starting Balance Management (bank balances by month).
2. Set Cash Starting Balance Management (USD and KHR by month).
3. Configure Expense Types.
4. Configure Income Types.
5. Configure Income Automation sources (income configs).

Outcome:
- Family has complete baseline data for calculations and reporting.

### C. Daily Operation

1. Open Daily Expense (All Banks, Bank, or Cash pages).
2. Add entries for each real transaction.
3. Set correct fields:
	 - Date
	 - Type (Income or Expense)
	 - Category
	 - Description
	 - Payment Method
	 - Amount
	 - Currency
4. Save record.
5. Edit or deactivate records when needed.

Outcome:
- Daily ledger is always current and auditable.

### D. Income Automation (monthly/yearly)

1. Go to Settings > Income Automation.
2. Add recurring income configs (name, amount, day of month, active/inactive).
3. Run process:
	 - Process Monthly: generate records for selected month
	 - Process Yearly: generate records for all months in selected year
4. System prevents duplicates and reports created/skipped counts.

Important:
- Only active income configs are processed.

Outcome:
- Recurring incomes are generated consistently.

### E. Monitoring and Review

1. Use dashboard cards for current month overview.
2. Filter by date, type, search text, and status.
3. Open detail dialog to inspect and correct records.

Outcome:
- Data quality is maintained continuously.

### F. Monthly Closing Routine

1. Confirm all daily transactions are complete.
2. Run income automation if not yet run.
3. Validate month totals (income vs expense).
4. Check balances and carryover logic.
5. Review monthly reports:
	 - Bank report
	 - Cash report

Outcome:
- Month is finalized with reliable numbers.

### G. User and Access Management

1. Admin manages users and family roles.
2. Ensure each user has correct family membership.
3. Remove or deactivate users no longer active.

Outcome:
- Secure and clean access control.

### H. Exception Handling

Use this quick diagnosis order when data looks wrong:

1. Confirm logged-in user belongs to the expected family.
2. Confirm required family settings exist (balances, categories, income configs).
3. Confirm filters are not hiding data (status/date/type).
4. Confirm records are active when expected.
5. Confirm environment/project is correct (dev vs prod).

Outcome:
- Faster troubleshooting and less downtime.

### I. Backup and Operational Discipline

1. Keep consistent naming for categories and payment methods.
2. Avoid duplicate manual entries before automation run.
3. Keep one canonical user profile per UID.
4. Perform periodic checks for data consistency.

Outcome:
- Stable long-term operations.

## 4. Recommended Daily Checklist

1. Verify today date and month filter.
2. Add all new transactions.
3. Review totals and unexpected spikes.
4. Fix wrong category/type entries immediately.
5. Confirm status is active for valid records.

## 5. Recommended Month-End Checklist

1. Complete all pending entries.
2. Run income automation and confirm results.
3. Review monthly bank and cash reports.
4. Lock in opening balances for next month.
5. Confirm user permissions and active accounts.

## 6. Data Model Summary

- Family-scoped root:
	- families/{familyId}/expenses
	- families/{familyId}/settings/config
	- families/{familyId}/members
- User profile:
	- system_users/{uid}

Settings config can include:

- balances (bank)
- cashBalances (cash)
- incomeConfigs
- incomeTypes
- expenseTypes

## 7. Run the System Locally

```bash
npm install
npm run dev
```

Then open:

- http://localhost:3000

## 8. Build Validation

```bash
npm run build
```

Use this before deployment to catch TypeScript or route issues.

## 9. Governance Notes

- Prefer API routes for write operations.
- Keep Firestore access family-scoped.
- Use role checks for admin-only actions.
- Keep compatibility logic only where needed during migration.

## 10. Success Criteria

Your system is considered healthy when:

1. Users can see data on first load (no manual refresh needed).
2. Daily entries and edits work without permission errors.
3. Income automation creates expected records.
4. Monthly reports match real balances.
5. Family isolation is preserved for all data and users.
