# Epics & User Stories

## Epic 1: Tap-to-Pay at Merchants

As a customer, I want to pay at Tap2 merchants with a single tap.

### User Stories

| ID         | Story                                                             | Priority | Acceptance Criteria                                                                                              |
| ---------- | ----------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| WALLET-001 | As a customer, I want to tap my phone to pay at any Tap2 merchant | P0       | - NFC tap initiates payment<br>- Payment completes in <3 seconds<br>- User receives haptic + visual confirmation |
| WALLET-002 | As a customer, I want to scan a QR code if NFC is unavailable     | P1       | - QR code scanner in app<br>- Fallback to QR when NFC fails                                                      |
| WALLET-003 | As a customer, I want to see my payment history                   | P1       | - List of all transactions<br>- Filter by date/merchant/amount                                                   |
| WALLET-004 | As a customer, I want to add a debit card as funding source       | P0       | - Secure card entry<br>- Card validation<br>- Set as default funding                                             |

## Epic 2: P2P Payments

As a user, I want to send money to friends instantly.

### User Stories

| ID      | Story                                                      | Priority | Acceptance Criteria                                                                        |
| ------- | ---------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| P2P-001 | As a user, I want to tap phones with someone to send money | P0       | - NFC tap detects recipient<br>- Enter amount and confirm<br>- Money transferred instantly |
| P2P-002 | As a user, I want to send money using a phone number       | P1       | - Enter recipient phone number<br>- Verify recipient name<br>- Send and confirm            |
| P2P-003 | As a user, I want to request money from a friend           | P1       | - Create payment request<br>- Recipient gets notification<br>- One-tap accept to receive   |
| P2P-004 | As a user, I want to split a bill with multiple people     | P2       | - Enter total amount<br>- Select contacts to split with<br>- Everyone pays their share     |

## Epic 3: Rewards Integration

As a customer, I want to earn and use rewards automatically.

### User Stories

| ID          | Story                                                         | Priority | Acceptance Criteria                                                      |
| ----------- | ------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| REWARDS-001 | As a customer, I want to earn points automatically when I pay | P0       | - Points credited after each purchase<br>- Notification of points earned |
| REWARDS-002 | As a customer, I want to see my rewards balance               | P0       | - Total points displayed<br>- Breakdown by merchant                      |
| REWARDS-003 | As a customer, I want to redeem points for discounts          | P1       | - Apply points at checkout<br>- See savings amount                       |
| REWARDS-004 | As a customer, I want to use points at any Tap2 merchant      | P1       | - Cross-merchant point redemption<br>- Points conversion to discount     |

## Epic 4: Wallet Management

As a user, I want to manage my wallet balance and funding sources.

### User Stories

| ID       | Story                                                | Priority | Acceptance Criteria                                                 |
| -------- | ---------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| MGMT-001 | As a user, I want to see my wallet balance           | P0       | - Current balance on home screen<br>- Real-time updates             |
| MGMT-002 | As a user, I want to add money from my bank account  | P0       | - Link bank account via Plaid<br>- Transfer funds to wallet         |
| MGMT-003 | As a user, I want to cash out to my bank account     | P1       | - Instant cashout (1.5% fee)<br>- Standard cashout (free, 1-2 days) |
| MGMT-004 | As a user, I want to manage multiple funding sources | P2       | - Add/remove cards and accounts<br>- Set default funding source     |

## Epic 5: Identity & Security

As a user, I want my account to be secure and verified.

### User Stories

| ID       | Story                                              | Priority | Acceptance Criteria                                                    |
| -------- | -------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| AUTH-001 | As a new user, I want to sign up with email/phone  | P0       | - Email and phone signup<br>- Verification code sent                   |
| AUTH-002 | As a user, I want to complete KYC verification     | P0       | - ID document upload<br>- Selfie verification<br>- Persona integration |
| AUTH-003 | As a user, I want to secure my app with biometrics | P1       | - Face ID / Touch ID support<br>- Fallback to PIN                      |
| AUTH-004 | As a user, I want to set up a spending PIN         | P0       | - 6-digit PIN for payments<br>- Can be reset with biometrics           |

## Epic 6: Virtual Card

As a user, I want a virtual debit card for online purchases.

### User Stories

| ID       | Story                                                | Priority | Acceptance Criteria                                             |
| -------- | ---------------------------------------------------- | -------- | --------------------------------------------------------------- |
| CARD-001 | As a user, I want to generate a virtual debit card   | P2       | - Virtual card number generated<br>- CVV and expiry provided    |
| CARD-002 | As a user, I want to freeze/unfreeze my virtual card | P2       | - Toggle card status<br>- Instant effect                        |
| CARD-003 | As a user, I want to view my virtual card details    | P2       | - Masked card number by default<br>- Reveal with authentication |

## Priority Legend

- **P0**: MVP - Must have for launch
- **P1**: High priority - Soon after launch
- **P2**: Medium priority - Future enhancement
