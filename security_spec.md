# DigiVault Security Specification

## 1. Data Invariants
1. **Owner-Only Isolation**: Every document in `/profiles/{userId}`, `/folders/{folderId}`, `/files/{fileId}`, and `/incomes/{incomeId}` belongs strictly to one authenticated, email-verified user (`request.auth.uid`). No cross-user reads, queries, updates, or deletes are permitted.
2. **Relational Folder Integrity**: A subfolder (`parentId != null`) cannot be created without an existing parent folder owned by the same `request.auth.uid`. A file (`folderId != null`) cannot be created or moved into a folder that does not exist or belongs to another user.
3. **Immutable Audit & Ownership Fields**: `userId` (`uid` on profiles) and `createdAt` cannot be modified after creation. Server timestamp `request.time` is strictly enforced on `createdAt` (create) and `updatedAt` (create & update).
4. **Financial Integrity**: `incomes.amount` must be a positive number (`> 0`). `incomes.paymentStatus` must be strictly `'lunas'` or `'belum_lunas'`. `incomes.transactionDate` must match `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`.
5. **Strict Key & Volumetric Caps**: Every document creation enforces exact required and allowed keys (`hasAll` + `hasOnly`), and every update enforces `affectedKeys().hasOnly(...)` per action, blocking shadow fields and oversized string/array payloads.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Unauthenticated user reads `/incomes` or creates a folder.
2. **Unverified Email Spoof**: Authenticated user with `email_verified: false` writes to `/profiles/{uid}`.
3. **Cross-User Profile Read (PII Leak)**: User B reads `/profiles/{userA}` or runs a `list` query on `/profiles`.
4. **Identity Spoofing on Create**: User A creates an income document with `userId: "userB_uid"`.
5. **Shadow Field Injection**: User A creates a folder with an extra field `{ isAdmin: true }`.
6. **Orphaned Subfolder Creation**: User A creates a folder with `parentId: "non_existent_folder"`.
7. **Cross-Owner Folder Hijack**: User A creates a file with `folderId: "userB_folder_id"`.
8. **Negative / Zero Income Amount**: User A creates an income record with `amount: 0` or `amount: -50000`.
9. **Invalid Payment Status**: User A updates an income record to `paymentStatus: "pending"` instead of `"lunas"` or `"belum_lunas"`.
10. **Client Timestamp Forgery**: User A creates an income record with a backdated `createdAt` not equal to `request.time`.
11. **Path ID Poisoning**: User A writes to `/folders/invalid$id!with*badchars` or a 200-char ID.
12. **Blanket List Query Scraping**: User A queries `/incomes` without filtering by `where('userId', '==', request.auth.uid)`.
