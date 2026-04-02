# Firestore Collections and Fields Reference

This document lists all fields for the main Firestore collections in your project, based on your current codebase.

---

## system_users (Collection)
**Document Path:** `system_users/{uid}`

**Fields:**
createdAt
"2026-02-15T06:44:18.172Z"
(string)


email
""
(string)


fullName
"Ramon OEM"
(string)


loginEmail
"ramonoem@clearport.local"
(string)


status
"active"
(string)


uid
"uGGXOe4cs2OgsBX93ZkhpVXCwB72"
(string)


userId
"001"
(string)


username
"ramonoem"

---

## expenses (Collection)
**Document Path:** `expenses/{expenseId}`

**Fields:**
- All fields from the expense form (see below for details)
- `status` (string): 'active' (default on create)
- `createdAt` (string): ISO date string

### Expense Form Fields (from code)
- (You may need to update this section with your actual form fields. Common examples:)
Amount
25
(number)


Category
"Other"
(string)


Credit
""
(string)


Currency
"USD"
(string)


Date
"2026-03-05"
(string)


Debit
""
(string)


Description
"Payment oun send for final dress oun"
(string)


Payment_Method
"Chip Mong Bank"
(string)


Type
"Expense"
(string)


createdAt
"2026-03-05T08:03:41.316Z"
(string)


status
"active"

---

## settings (Collection)
balance_2026_0

balance_2026_1

balance_chip-mong_2026_0

balance_chip-mong_2026_1

expenseTypes


    balance_2026_0 -> amount
586
(number)


updatedAt
"2026-02-17T13:12:34.343Z"
(string)








### Expense Types
**Document Path:** `settings/expenseTypes`
- expenseTypes
types
(array)


0
"Food & Drinks"
(string)


1
"Transportation"
(string)


2
"Shopping"
(string)


3
"Utilities"
(string)


4
"Entertainment"
(string)


5
"Health"
(string)


6
"Education"
(string)


7
"Investment"
(string)


8
"Gift & Donation"
(string)


9
"Family"
(string)


10
"Other"

### Income Types
**Document Path:** `settings/incomeTypes`
amount
420
(number)


dayOfMonth
10
(number)


name
"Wife"
(string)


status
"inactive"
(string)

### Other Settings
- Other settings documents in the `settings` collection follow a similar pattern, with a key (like `expenseTypes` or `incomeTypes`) and a `types` array.

---

## Example Documents

### system_users Example
```json
{
  "fullName": "John Doe",
  "username": "johndoe",
  "userId": "USR123",
  "email": "john@example.com",
  "loginEmail": "john@example.com",
  "status": "active",
  "uid": "firebase-uid-xyz",
  "createdAt": "2026-03-06T12:00:00.000Z"
}
```

### expenses Example
```json
{
  "amount": 100,
  "category": "Food",
  "date": "2026-03-06",
  "description": "Lunch",
  "paymentMethod": "cash",
  "status": "active",
  "createdAt": "2026-03-06T12:00:00.000Z"
}
```

### settings/expenseTypes Example
```json
{
  "types": ["Food", "Transport", "Utilities"]
}
```

### settings/incomeTypes Example
```json
{
  "types": ["Salary", "Bonus", "Investment"]
}
```

---

*Update this file as your data model evolves.*
