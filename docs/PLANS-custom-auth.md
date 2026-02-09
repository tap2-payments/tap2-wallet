# Custom Authentication Implementation Plan

## Overview

Replace Auth0 with custom authentication built on Cloudflare Workers. This provides cost savings, vendor independence, and edge-native performance.

**Status**: Planning
**Epic**: Epic 5 - Identity & Security
**Priority**: High (foundational feature)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Mobile App (React Native)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │ Login       │  │ Register    │  │ Social      │  │ MFA         ││
│  │ Form        │  │ Form        │  │ Buttons     │  │ Setup       ││
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘│
│         │                │                │                │        │
│         └────────────────┴────────────────┴────────────────┘        │
│                                 │                                  │
└─────────────────────────────────┼──────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Cloudflare Workers (Auth Service)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │ Password    │  │ JWT         │  │ Social      │  │ MFA         ││
│  │ Auth        │  │ Service     │  │ OAuth       │  │ Service     ││
│  │ (Argon2)    │  │ (sign/verify)│ │ (Apple/G)   │  │ (TOTP)      ││
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘│
│         │                │                │                │        │
│         └────────────────┴────────────────┴────────────────┘        │
│                                  │                                  │
│         ┌────────────────────────┼────────────────────────┐         │
│         ▼                        ▼                        ▼         │
│  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐     │
│  │ D1          │        │ D1          │        │ KV          │     │
│  │ (users)     │        │ (sessions)  │        │ (rate limit)│     │
│  └─────────────┘        └─────────────┘        └─────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Users Table (D1)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT,              -- Argon2id (NULL for social auth)
  social_provider TEXT,            -- 'apple', 'google', or NULL
  social_id TEXT,                  -- Provider's user ID
  kyc_verified INTEGER DEFAULT 0,
  kyc_verified_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

### Sessions Table (D1)

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  device_id TEXT NOT NULL,         -- Device fingerprint
  refresh_token_hash TEXT NOT NULL,-- Hashed refresh token
  expires_at TEXT NOT NULL,        -- ISO timestamp
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

### MFA Secrets Table (D1)

```sql
CREATE TABLE mfa_secrets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  secret TEXT NOT NULL,            -- TOTP secret (encrypted)
  backup_codes TEXT,               -- JSON array of hashed codes
  verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

## API Endpoints

### Authentication

| Method | Endpoint                   | Description                 |
| ------ | -------------------------- | --------------------------- |
| POST   | `/v1/auth/register`        | Email/password registration |
| POST   | `/v1/auth/login`           | Email/password login        |
| POST   | `/v1/auth/logout`          | Invalidate session          |
| POST   | `/v1/auth/refresh`         | Refresh access token        |
| POST   | `/v1/auth/verify-email`    | Verify email ownership      |
| POST   | `/v1/auth/forgot-password` | Initiate password reset     |
| POST   | `/v1/auth/reset-password`  | Complete password reset     |

### Social Authentication

| Method | Endpoint                 | Description                     |
| ------ | ------------------------ | ------------------------------- |
| POST   | `/v1/auth/social/apple`  | Apple Sign In callback          |
| POST   | `/v1/auth/social/google` | Google Sign In callback         |
| POST   | `/v1/auth/social/link`   | Link social to existing account |

### Multi-Factor Authentication

| Method | Endpoint                   | Description              |
| ------ | -------------------------- | ------------------------ |
| POST   | `/v1/auth/mfa/setup`       | Initiate MFA setup       |
| POST   | `/v1/auth/mfa/verify`      | Verify and enable MFA    |
| POST   | `/v1/auth/mfa/disable`     | Disable MFA              |
| POST   | `/v1/auth/mfa/verify-code` | Verify TOTP during login |

## Implementation Details

### 1. Password Hashing (Argon2id)

**Why Argon2id?**

- Memory-hard, resistant to GPU/ASIC attacks
- Winner of Password Hashing Competition 2015
- Recommended by OWASP for new implementations

**Implementation:**

```typescript
// Using @noble/hashes (pure JS, works in Workers)
import { argon2id } from '@noble/hashes/argon2';
import { sha256 } from '@noble/hashes/sha256';

const hashPassword = async (password: string, salt: Uint8Array): Promise<string> => {
  return await argon2id(password, salt, {
    t: 3, // Time cost (iterations)
    m: 65536, // Memory cost in KiB (64 MB)
    p: 4, // Parallelism
    dkLen: 32, // Output length
  });
};
```

**Parameters Rationale:**

- `t: 3` - Balanced for edge compute (~100ms)
- `m: 65536` - 64 MB (OWASP minimum)
- `p: 4` - Parallelism for multi-core
- `dkLen: 32` - 256-bit output

### 2. JWT Token Management

**Access Token (short-lived):**

```typescript
interface AccessTokenPayload {
  sub: string; // User ID
  iat: number; // Issued at
  exp: number; // Expiration (15 min)
  iss: string; // Issuer (tap2.wallet)
  aud: string; // Audience (api.tap2.wallet)
  jti: string; // JWT ID (token identifier)
}
```

**Refresh Token (long-lived):**

```typescript
interface RefreshTokenPayload {
  sub: string; // User ID
  jti: string; // Session ID
  iat: number;
  exp: number; // Expiration (30 days)
  device_id: string;
}
```

**Signing (Workers Crypto API):**

```typescript
import { SignJWT, jwtVerify } from 'jose';

const signAccessToken = async (payload: AccessTokenPayload, secret: string) => {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(secret));
};
```

### 3. Session Management

**KV Structure (for fast lookups):**

```
session:{session_id}         -> { user_id, device_id, expires_at }
session:user:{user_id}       -> [session_id1, session_id2, ...]
rate_limit:{ip}:{endpoint}  -> { count, reset_at }
```

**Session Flow:**

1. Login creates session in D1 + KV cache
2. Access token used for API requests
3. Refresh token validates against D1 + KV
4. Logout deletes from D1 and invalidates in KV

### 4. Social OAuth Integration

**Apple Sign In:**

```typescript
interface AppleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token: string; // JWT with email
  refresh_token: string;
}

// Verify Apple JWT
const verifyAppleToken = async (idToken: string) => {
  const payload = await jwtVerify(idToken, applePublicKey);
  return {
    email: payload.email,
    sub: payload.sub, // Apple user ID
    emailVerified: payload.email_verified,
  };
};
```

**Google Sign In:**

```typescript
interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token: string;
}

// Verify Google JWT
const verifyGoogleToken = async (idToken: string) => {
  const response = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + idToken);
  return await response.json();
};
```

### 5. MFA (TOTP)

**Setup Flow:**

1. Generate random secret (base32)
2. Generate QR code (otpauth URI)
3. User scans with authenticator app
4. User enters code to verify
5. Store encrypted secret in D1

**Verification:**

```typescript
import { TOTP } from 'otpauth';

const verifyTOTP = (secret: string, token: string): boolean => {
  const totp = new TOTP({
    secret: secret,
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  });
  return totp.validate({ token: token }) !== null;
};
```

### 6. Rate Limiting

**Strategy:**

- Auth endpoints: 5 requests per minute per IP
- Login endpoint: 3 attempts per 5 minutes per email
- Password reset: 1 per hour per email

**Implementation (KV):**

```typescript
const checkRateLimit = async (kv: KVNamespace, key: string, limit: number, window: number) => {
  const now = Date.now();
  const data = (await kv.get(key, 'json')) as { count: number; resetAt: number } | null;

  if (!data || now > data.resetAt) {
    await kv.put(key, JSON.stringify({ count: 1, resetAt: now + window * 1000 }), {
      expirationTtl: window,
    });
    return true;
  }

  if (data.count >= limit) {
    return false;
  }

  await kv.put(key, JSON.stringify({ count: data.count + 1, resetAt: data.resetAt }), {
    expirationTtl: Math.ceil((data.resetAt - now) / 1000),
  });
  return true;
};
```

## Security Considerations

### Password Requirements

- Minimum 12 characters
- Require 3 of: uppercase, lowercase, number, symbol
- Check against common passwords (haveibeenpwned API)
- Prevent password reuse (store hash history)

### Token Storage (Mobile)

- Access token: Memory only
- Refresh token: Encrypted storage (Keychain/Keystore)
- Biometric unlock for sensitive operations

### Device Binding

- Generate device fingerprint on first login
- Require re-auth for new devices
- Notify user of new device sign-ins

### Account Recovery

- Email verification (time-limited code)
- Backup MFA codes (one-time use)
- Social auth as recovery method

## Implementation Phases

### Phase 1: Foundation (Week 1)

- [ ] D1 schema migrations (users, sessions, mfa_secrets)
- [ ] Password hashing utility (Argon2id)
- [ ] JWT sign/verify utilities with key versioning
- [ ] Basic auth middleware for Workers
- [ ] KV rate limiting utility

### Phase 2: Password Auth (Week 1-2)

- [ ] Registration endpoint
- [ ] Login endpoint
- [ ] Logout endpoint
- [ ] Token refresh endpoint
- [ ] Session management (D1 + KV)

### Phase 3: Social Auth (Week 2)

- [ ] Apple Sign In integration
- [ ] Google Sign In integration
- [ ] Social account linking
- [ ] Social auth to existing account merge

### Phase 4: MFA (Week 3)

- [ ] TOTP setup endpoint
- [ ] TOTP verification
- [ ] Backup codes generation
- [ ] MFA enforcement policies

### Phase 5: Security Features (Week 4)

- [ ] Rate limiting (all endpoints)
- [ ] Device management
- [ ] Security audit logging
- [ ] Device fingerprinting

### Phase 6: Mobile Integration (Week 4)

- [ ] React Native auth context
- [ ] Secure token storage (Keychain/Keystore)
- [ ] Biometric auth integration
- [ ] Auto-token refresh
- [ ] Error handling

### Phase 7: Email/SMS Integration (Week 5)

- [ ] Resend email templates
- [ ] Email verification flow
- [ ] Password reset emails
- [ ] Twilio SMS verification
- [ ] Phone number verification flow

## Dependencies

### Backend (Workers)

```json
{
  "@noble/hashes": "^1.5.0",
  "jose": "^5.9.0",
  "otpauth": "^9.2.0",
  "drizzle-orm": "^0.33.0"
}
```

### Mobile (React Native)

```json
{
  "@react-native-keychain/polyfill-web": "^0.1.0",
  "react-native-keychain": "^9.0.0",
  "expo-local-authentication": "^14.0.0",
  "@react-navigation/native": "^6.1.0"
}
```

## Testing Strategy

### Unit Tests

- Password hashing/verification
- JWT generation/validation
- TOTP code generation/verification
- Rate limit logic

### Integration Tests

- Full registration flow
- Full login flow (password + social)
- Token refresh flow
- MFA setup/verification flow

### Security Tests

- SQL injection attempts
- Rate limit bypass attempts
- Token manipulation
- Session hijacking scenarios

## Monitoring

### Metrics to Track

- Registration rate
- Login success/failure rate
- MFA adoption rate
- Social auth vs password auth split
- Token refresh rate
- Suspicious activity patterns

### Alerts

- Brute force attack patterns
- Unusual login locations
- MFA bypass attempts
- High rate of failed logins

## Rollout Plan

1. **Staging**: Deploy to staging, test all flows
2. **Beta**: Limited rollout to beta users (100 users)
3. **Phase 1**: 10% of new users
4. **Phase 2**: 50% of new users
5. **Full**: 100% of new users
6. **Migration**: Existing users migrate on next login

## External Services

### Email Provider: Resend

- **Why**: Modern API, excellent React support, generous free tier (3,000 emails/month)
- **Use cases**: Email verification, password reset, security alerts
- **Integration**: Workers fetch API, SDK available

### SMS Provider: Twilio

- **Why**: Industry standard, reliable, comprehensive documentation
- **Use cases**: Phone verification (signup), security alerts (suspicious activity)
- **Integration**: Workers fetch API to Twilio REST API

### Environment Variables

```bash
# Resend
RESEND_API_KEY=re_*

# Twilio
TWILIO_ACCOUNT_SID=AC*
TWILIO_AUTH_TOKEN=*
TWILIO_PHONE_NUMBER=+1xxx
```

## JWT Secret Rotation Strategy

### Recommended: Key Versioning with Grace Period

**Strategy**: Maintain multiple active signing keys with version identifiers in JWT header.

**How it works:**

1. Keys stored in environment with version suffix (`JWT_SECRET_v1`, `JWT_SECRET_v2`)
2. JWT header includes `kid` (Key ID) field: `{ "alg": "HS256", "kid": "v2" }`
3. Verification tries all keys; signing uses latest
4. Old key kept for ~30 days after rotation (token expiration + buffer)

**Implementation:**

```typescript
// Environment variables
// JWT_SECRET_v2=<current-secret> (for signing)
// JWT_SECRET_v1=<previous-secret> (verification only)

const secrets = {
  v2: env.JWT_SECRET_v2, // Current (signing)
  v1: env.JWT_SECRET_v1, // Previous (verification only)
};

const currentVersion = 'v2';

// Sign with current key
const signAccessToken = async (payload: AccessTokenPayload) => {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', kid: currentVersion, typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(secrets[currentVersion]));
};

// Verify with any key
const verifyAccessToken = async (token: string) => {
  const header = decodeProtectedHeader(token);
  const key = secrets[header.kid as keyof typeof secrets];

  if (!key) {
    throw new Error('Unknown key version');
  }

  return await jwtVerify(token, new TextEncoder().encode(key));
};
```

**Rotation Process:**

1. Add new secret to environment (`JWT_SECRET_v3`)
2. Deploy with new secret as signing key
3. Keep old secret in env for verification (30 days)
4. After grace period, remove old secret from code/env
5. Repeat annually or if compromise suspected

**Benefits:**

- Zero downtime during rotation
- Tokens remain valid until natural expiration
- Quick response to security incidents
- Simple implementation, no external dependencies

## References

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [RFC 9106 - Argon2](https://www.rfc-editor.org/rfc/rfc9106.html)
- [RFC 7519 - JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519.html)
- [RFC 6238 - TOTP](https://www.rfc-editor.org/rfc/rfc6238.html)
- [Cloudflare Workers Crypto API](https://developers.cloudflare.com/workers/runtime-apis/)
