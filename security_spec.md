# Firestore Security Specification

## 1. Data Invariants
- **Users**: Users can only read and write their own profile (`request.auth.uid == userId` or `resource.data.id == request.auth.uid`). Balance changes and sensitive operations are validated.
- **Transactions**: Financial records are strictly tied to the owner (`resource.data.userId == request.auth.uid`). Transactions are immutable after creation.
- **Affiliates**: Affiliate accounts can only be accessed and modified by their respective owners (`resource.data.userId == request.auth.uid`).
- **Referrals**: Referral entries can only be read by the affiliate owner or the referred user.
- **Games**: Read-only public catalog for authenticated users. Writes are forbidden for regular clients.

## 2. Dirty Dozen Test Payloads
1. **Unauthenticated User Read**: Attempt to read `/users/usr_123` without auth token (Expected: PERMISSION_DENIED).
2. **Cross-User Data Read**: Attempt by User A (`uid_A`) to read User B's `/users/uid_B` profile (Expected: PERMISSION_DENIED).
3. **Transaction Spoofing**: Attempt by User A to read User B's transaction history in `/transactions` (Expected: PERMISSION_DENIED).
4. **Transaction Tampering**: Attempt by User A to update or delete an existing transaction (Expected: PERMISSION_DENIED).
5. **Unauthorized Deposit Creation**: Attempt by User A to create a transaction under User B's `userId` (Expected: PERMISSION_DENIED).
6. **Affiliate Hijacking**: Attempt by User A to view User B's affiliate commissions or balance (Expected: PERMISSION_DENIED).
7. **Affiliate Balance Manipulation**: Attempt to update an affiliate document with arbitrary commission totals (Expected: PERMISSION_DENIED).
8. **Referral Data Scraping**: Attempt by an unauthenticated user to dump the `/referrals` collection (Expected: PERMISSION_DENIED).
9. **Game Catalog Tampering**: Attempt by a regular user to modify or delete a game entry in `/games` (Expected: PERMISSION_DENIED).
10. **Ghost Field Injection**: Attempt to create a user profile with unauthorized admin fields like `isAdmin: true` (Expected: PERMISSION_DENIED).
11. **ID Poisoning Attack**: Attempt to pass non-alphanumeric or oversized string as document ID (Expected: PERMISSION_DENIED).
12. **Blind List Query**: Attempt to run `getDocs(collection('transactions'))` without filtering by `userId` (Expected: PERMISSION_DENIED).
