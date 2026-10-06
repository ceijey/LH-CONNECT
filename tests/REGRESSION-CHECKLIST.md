# LH-Connect Regression Checklist

Use this checklist against a staging deployment with test accounts and test payment records only.

## Preconditions

- Set `ENCRYPTION_KEY` in the staging environment.
- Use one admin account, two approved residents, and one pending resident.
- Record the test build commit, browser, device, and test date.
- Keep a reset copy of the staging database or use uniquely identifiable test records.
- Confirm email/SMS test destinations before sending notifications.

## Smoke Test

- Login as admin and resident.
- Load dashboard, residents, payments, messages, announcements, statements, and reports.
- Logout, refresh protected pages, and confirm redirect to login.
- Confirm database/API errors show an unavailable state rather than sample data.

## Authorization and Privacy

- Anonymous request to every API route returns `401` or `403`.
- Resident cannot access admin dashboard, reports, audit logs, or announcement viewers.
- Resident A cannot read Resident B payments, statements, notifications, proofs, or messages.
- Resident cannot reply to an unrelated message thread.
- Resident can message only the HOA admin.
- Admin can access organization-wide reports and resident history.

## Resident Workflow

- Register or create a resident account.
- Pending resident cannot access approved resident workflows.
- Admin approval changes the account state and sends the expected notification.
- Profile update changes allowed fields only.
- Phone data remains encrypted in Firestore and is displayed only to authorized users.
- Profile update cannot directly change the resident balance.

## Payment Workflow

- Reject zero, negative, non-numeric, and oversized payment amounts.
- Reject duplicate reference numbers and duplicate OR numbers.
- Submit one valid payment proof and confirm it appears as Pending.
- Reject invalid file types and files over 5 MB.
- Verify a payment once and confirm exactly one payment record is created.
- Repeat the verification request and confirm no duplicate payment or balance deduction occurs.
- Reject a payment and confirm the resident notification and reason.
- Test partial payment, oldest-unpaid-month allocation, and fully paid account behavior.
- Confirm statements, payment submissions, payments, and displayed balance agree after each case.

## Resilience and Recovery

- Temporarily make Firestore unavailable in staging or use a controlled emulator failure.
- Confirm sensitive APIs return `503` without fabricated records.
- Confirm mail/SMS failure does not corrupt the payment transaction.
- Refresh after a failed request and confirm retry behavior is safe.
- Confirm logout clears session and CSRF cookies.

## SUS Evidence

For each participant, record:

- Task completion: completed, completed with help, or failed.
- Time on task.
- Number of errors.
- One usability comment.
- SUS answers 1-10 using the standard 1-5 scale.

Recommended tasks:

1. Resident logs in and checks the current statement.
2. Resident submits a payment proof.
3. Resident checks payment status and notification.
4. Admin approves a payment.
5. Admin posts an announcement.
6. Admin finds a delinquent resident and opens the payment history.

## Release Gate

UAT can be marked passed only when all critical authorization and payment cases pass, no fabricated data appears, encryption is configured, and the build plus regression suite are green.
