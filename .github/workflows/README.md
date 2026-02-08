# GitHub Actions Workflows

This directory contains CI/CD workflows for the Tap2 Wallet monorepo.

## Workflows

### CI Workflows

| Workflow | Triggers | Purpose |
|----------|----------|---------|
| `backend-ci.yml` | PR to main, push to main, changes to `backend/**` | Test, lint, and type check backend |
| `mobile-ci.yml` | PR to main, push to main, changes to `mobile/**` | Test, lint, and type check mobile app |
| `marketing-ci.yml` | PR to main, push to main, changes to `marketing/**` | Build and type check marketing site |

### CD Workflow

| Workflow | Triggers | Purpose |
|----------|----------|---------|
| `deploy.yml` | Push to main only | Deploy backend to Cloudflare Workers, marketing to Cloudflare Pages |

## Required Secrets

The following secrets must be configured in your GitHub repository settings:

### Cloudflare Secrets

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `CLOUDFLARE_API_TOKEN` | API token for deploying to Cloudflare | See instructions below |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | Found in Cloudflare dashboard URL |

### Creating a Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template or create a custom token with:
   - **Account** > **Cloudflare Workers** > **Edit**
   - **Account** > **Cloudflare Workers Scripts** > **Edit**
   - **Account** > **Account Settings** > **Read**
4. Set "Account Resources" to include your account
5. Click "Continue to summary" and then "Create Token"
6. Copy the token (you won't be able to see it again)

### Finding Your Cloudflare Account ID

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your account (if you have multiple)
3. Your Account ID is in the URL: `https://dash.cloudflare.com/<ACCOUNT_ID>/...`
4. Or scroll down on any page to find it in the right sidebar

### Adding Secrets to GitHub

1. Go to your repository on GitHub
2. Click **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add each secret with its name and value

## Workflow Details

### Backend CI (`backend-ci.yml`)

- Runs on: `ubuntu-latest`
- Node.js version: 20
- Caches `npm` dependencies
- Steps:
  1. Checkout repository
  2. Setup Node.js with cache
  3. Install dependencies (`npm ci`)
  4. Type check (`tsc --noEmit`)
  5. Lint (`eslint`)
  6. Test (`vitest --run --coverage`)

### Mobile CI (`mobile-ci.yml`)

- Runs on: `ubuntu-latest`
- Node.js version: 20
- Caches `npm` dependencies
- Steps:
  1. Checkout repository
  2. Setup Node.js with cache
  3. Install dependencies (`npm ci`)
  4. Type check (`tsc --noEmit`)
  5. Lint (`eslint`)
  6. Test (`jest --ci --coverage`)

### Marketing CI (`marketing-ci.yml`)

- Runs on: `ubuntu-latest`
- Node.js version: 20
- Caches `npm` dependencies
- Steps:
  1. Checkout repository
  2. Setup Node.js with cache
  3. Install dependencies (`npm ci`)
  4. Type check (`astro check`)
  5. Build (`astro build`)

### Deploy (`deploy.yml`)

- Runs on: `ubuntu-latest`
- Only triggers on push to `main` branch
- Uses path filters to detect changed directories
- Only deploys services that have changed
- Depends on CI passing first

**Backend Deployment:**
- Builds TypeScript (`tsc`)
- Deploys to Cloudflare Workers via `wrangler deploy --env production`
- Worker name: `tap2-wallet-api`

**Marketing Deployment:**
- Builds Astro site (`astro build`)
- Deploys to Cloudflare Pages
- Project name: `tap2-wallet-marketing`

## Local Development

To run the same checks locally before pushing:

```bash
# Backend
cd backend
npm run typecheck
npm run lint
npm run test:ci

# Mobile
cd mobile
npm run typecheck
npm run lint
npm run test:ci

# Marketing
cd marketing
npm run typecheck
npm run build
```

## Troubleshooting

### Deploy failures

- Verify secrets are correctly set in GitHub repository settings
- Check that your Cloudflare API token has the correct permissions
- Ensure the `wrangler.toml` configuration is correct

### CI failures

- Run the same commands locally to reproduce
- Check that all dependencies are correctly installed
- Verify TypeScript configuration is correct

### Mobile app CI

- The mobile CI runs headless tests without a device simulator
- For E2E tests, you would need additional setup with iOS/Android simulators
