# TAP2 WALLET

# Digital Wallet & Consumer Payments

# Product Requirements Document

# Version 1.0 | February 2026

# CONFIDENTIAL - Tap2 / CloudMind Inc.

## Document Information

| Attribute    | Value             |
| ------------ | ----------------- |
| Product Name | Tap2 Wallet       |
| Category     | Consumer Products |
| Status       | Planning          |
| Owner        | Tap2 Product Team |
| Last Updated | February 2026     |

## Executive Summary

Tap2 Wallet is a consumer-facing digital wallet that enables tap-to-pay at any Tap2 merchant, P2P payments between users, and integration with loyalty rewards. It creates the demand side of the Tap2 payment network.

### Key Value Propositions

- Pay with a tap at any Tap2 merchant
- Send money to friends instantly
- Earn and redeem rewards automatically
- Track all spending in one place
- Virtual debit card for online purchases
- Connect any bank account or card

## Problem Statement

### Pain Points Addressed

| Pain Point           | Impact                                | Solution                  |
| -------------------- | ------------------------------------- | ------------------------- |
| Wallet Fragmentation | Multiple apps for different merchants | One wallet for everything |
| Lost Rewards         | Forget to use loyalty cards           | Automatic reward earning  |
| Payment Friction     | Open app, authenticate, select card   | Single tap payment        |
| P2P Complexity       | Need recipient username/phone         | Tap phones to send money  |

### Target Users

- **Regular Shoppers**: Frequent customers of Tap2 merchants
- **Young Consumers**: Gen Z and Millennials preferring mobile payments
- **Rewards Seekers**: Users who actively collect and use rewards
- **P2P Senders**: People who frequently split bills or send money

## Core Features

### 1. Tap-to-Pay

Pay at merchants by tapping your phone.

- **NFC Payment**: Tap phone to merchant's phone
- **QR Fallback**: Scan code if NFC unavailable
- **Instant Confirmation**: Visual and haptic feedback

### 2. P2P Payments

Send money to friends and family instantly.

- **Tap to Send**: Tap phones together to transfer
- **Request Money**: Send payment requests
- **Split Bills**: Divide expenses automatically

### 3. Rewards Integration

Earn and use rewards seamlessly.

- **Auto-Earn**: Rewards credited automatically
- **Cross-Merchant**: Use points at any participating merchant
- **Personalized**: AI-powered reward recommendations

## Technical Architecture

### System Components

| Component        | Description                        | Technology       |
| ---------------- | ---------------------------------- | ---------------- |
| Mobile App       | Consumer iOS/Android app           | React Native     |
| Wallet Core      | Balance and transaction management | CardQL           |
| Rewards Engine   | Loyalty point calculation          | Tap2 Rewards API |
| Identity Service | KYC and authentication             | Auth0, Persona   |

### API Endpoints

| Endpoint              | Method | Description        |
| --------------------- | ------ | ------------------ |
| `/v1/wallet/balance`  | GET    | Get wallet balance |
| `/v1/wallet/pay`      | POST   | Make a payment     |
| `/v1/wallet/transfer` | POST   | P2P money transfer |
| `/v1/wallet/rewards`  | GET    | Rewards balance    |

## Pricing Model

| Tier/Item       | Price | Notes                   |
| --------------- | ----- | ----------------------- |
| App Download    | Free  | iOS and Android         |
| P2P Transfers   | Free  | Instant, no fees        |
| Card Funding    | Free  | Add money from debit    |
| Instant Cashout | 1.5%  | Instant to bank account |

## Competitive Analysis

| Feature                | Tap2 Wallet | Apple Pay | Venmo | PayPal |
| ---------------------- | ----------- | --------- | ----- | ------ |
| Tap-to-Send P2P        | Yes         | No        | No    | No     |
| Cross-Merchant Rewards | Yes         | No        | No    | No     |
| No Fees P2P            | Yes         | Yes       | Yes   | Yes    |
| Merchant Discovery     | Yes         | No        | No    | No     |
| Tap to Phone           | Yes         | Yes       | No    | No     |

## Success Metrics

| Metric                  | Target      | Current |
| ----------------------- | ----------- | ------- |
| Monthly Active Users    | 500,000     | N/A     |
| P2P Volume              | $50M/month  | N/A     |
| Wallet Transactions     | $200M/month | N/A     |
| User Retention (30-day) | >60%        | N/A     |

## Implementation Roadmap

| Phase     | Timeline | Deliverables                       |
| --------- | -------- | ---------------------------------- |
| MVP       | Q2 2026  | Basic wallet, tap-to-pay, P2P      |
| Rewards   | Q3 2026  | Loyalty integration, cashback      |
| Expansion | Q4 2026  | Virtual card, budgeting tools      |
| Scale     | 2027     | Bill pay, subscriptions, investing |

---

_End of Document_
