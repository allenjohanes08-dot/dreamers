# Security Specification for Dreamers App

## 1. Data Invariants
- A `userProfile` record must exist for every user. `uid` and `email` are immutable.
- A `notification` must have a valid `userId` existing in the `users` collection.
- `giftCardRequest` and `registryRequest` must belong to a valid `userId` and cannot be modified by the user after creation (only admin).
- `eventInvitation` must be linked to a valid `invitedUserUid` and must have a secure, random `verificationToken`.
- Roles (`role`, `verifiedRole`) and status (`verificationStatus`) can NEVER be set by the user during profile update, only by an Admin.
- Timestamps (`createdAt`, `updatedAt`) must always be set to server time.

## 2. The "Dirty Dozen" Payloads
1. User updating their own `verifiedRole` to 'ADMIN'.
2. User creating a `notification` document.
3. User updating `status` of their own `giftCardRequest`.
4. User injecting a 1.5KB string into `userId` field of a `notification`.
5. User querying all users via an insecure `list` operation.
6. User reading another user's PII in the `users` collection.
7. User setting `createdAt` to a timestamp in the future.
8. User creating an `eventInvitation` with a `verificationToken` of their own choosing.
9. User modifying `roleVerificationStatus` to 'VERIFIED'.
10. Admin promotion attempt by a non-admin user.
11. Attempting to create an `eventInvitation` without an `eventId`.
12. Attempting to update a `giftCardRequest` that is already 'COMPLETED'.

## 3. The Test Runner
To be implemented in `firestore.rules.test.ts`.
