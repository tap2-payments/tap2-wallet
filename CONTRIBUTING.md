# Contributing to Tap2 Wallet

Thank you for your interest in contributing to Tap2 Wallet! This document provides guidelines and workflows for contributing to the project.

## Development Workflow

### 1. Branch Naming

All coding work must be done in feature branches with appropriate naming:

- `feat/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation changes
- `test/` - Test additions or modifications
- `chore/` - Maintenance tasks

Examples:
- `feat/add-nfc-payment`
- `fix/payment-timeout`
- `refactor/database-connection`

### 2. Creating a Feature Branch

```bash
# Make sure you're on main and it's up to date
git checkout main
git pull origin main

# Create a new feature branch
git checkout -b feat/your-feature-name
```

### 3. Development Process

1. **Write tests first** (TDD approach)
   - Write failing tests that demonstrate the desired behavior
   - Run tests to confirm they fail
   - Implement the feature
   - Run tests to confirm they pass

2. **Code with type safety**
   - Never use `any` type - always use proper TypeScript types
   - Use `@/` aliases instead of relative paths for imports
   - Ensure all code passes type checking

3. **Commit frequently**
   - Write clear, descriptive commit messages
   - Keep commits focused and atomic
   - Run tests before committing

### 4. Creating a Pull Request

Before creating a PR:
- [ ] All tests pass (`npm test` in each workspace)
- [ ] Code is properly formatted (`npm run lint:fix`)
- [ ] TypeScript type checking passes (`npm run typecheck`)
- [ ] Your branch is up to date with main
- [ ] PR description explains the "why" not just the "what"

```bash
# Push your branch
git push -u origin feat/your-feature-name

# Create PR with auto-filled description
gh pr create --fill
```

### 5. PR Size Guidelines

- Aim for **<400 lines changed** per PR
- If a task is large, break it into multiple sequential PRs
- Each PR should be reviewable in one sitting
- One feature/fix per PR - don't bundle unrelated changes

### 6. After PR Merge

```bash
# Return to main and pull latest changes
git checkout main
git pull origin main

# Delete the merged branch (optional)
git branch -d feat/your-feature-name
```

## Code Style Guidelines

### TypeScript

- **No `any` types** - Always define proper types
- Use `interface` for object shapes, `type` for unions/intersections
- Prefer `const` over `let`
- Use arrow functions for callbacks
- Explicit return types for public functions

```typescript
// Good
interface User {
  id: string;
  email: string;
}

function getUserById(id: string): User | null {
  // ...
}

// Bad
function getUserById(id: any): any {
  // ...
}
```

### Import Paths

Use `@/` aliases instead of relative paths:

```typescript
// Good
import { Button } from '@/components/Button';
import { useAuth } from '@/hooks/useAuth';

// Bad
import { Button } from '../../../components/Button';
import { useAuth } from '../../hooks/useAuth';
```

### Backend (Hono)

- Use Hono's built-in validator with Zod
- Keep routes organized by version in `src/routes/v1/`
- Services go in `src/services/`
- Types go in `src/types/`

### Mobile (React Native)

- Use Zustand for state management
- Follow React Navigation patterns
- Keep components in `src/components/`
- Screens go in `src/screens/`

## Testing Requirements

### Unit Tests

- Write tests for all business logic
- Aim for >70% code coverage
- Use Vitest for backend, Jest for mobile
- Mock external dependencies

### Test-Driven Development

1. **RED** - Write a failing test
2. **GREEN** - Write minimal code to pass
3. **REFACTOR** - Improve while keeping tests green

### Running Tests

```bash
# Backend
cd backend
npm test              # Run all tests
npm run test:ci       # Run with coverage
npm run test:ui       # Interactive test UI

# Mobile
cd mobile
npm test              # Run all tests
npm run test:ci       # Run with coverage
```

## Linting and Formatting

### Linting

Each workspace has ESLint configured:

```bash
# Backend
cd backend && npm run lint          # Check for issues
npm run lint:fix                    # Auto-fix issues

# Mobile
cd mobile && npm run lint
npm run lint:fix
```

### Formatting

Use Prettier for consistent code formatting:

```bash
# Format all files in a workspace
npx prettier --write "**/*.{ts,tsx,js,jsx,json,md}"
```

## Git Safety Rules

### Before Removing Git Worktrees

```bash
# Check for open PRs first
gh pr list --head branch-name --state open
```

Never remove worktrees that have:
- Open pull requests
- Uncommitted changes
- Lock files present

### Handling Destructive Changes

- Get explicit approval before running destructive git commands
- Avoid `git push --force` unless absolutely necessary
- Never force push to main/master

## Environment Variables

### Backend (.env)

Required variables (see `backend/.env.example`):
- Database connection
- JWT secrets
- External API keys (Stripe, Auth0, etc.)

### Mobile (.env)

Required variables (see `mobile/.env.example`):
- API endpoints
- Auth configuration
- Feature flags

## Common Issues

### Port Already in Use

```bash
# Find and kill process using the port
lsof -ti:3001 | xargs kill -9  # macOS/Linux
```

### Cloudflare Workers Issues

```bash
# Reinstall wrangler
cd backend
npm uninstall wrangler
npm install wrangler@latest
```

### Mobile Build Issues

```bash
# Clear cache and reinstall
cd mobile
rm -rf node_modules
npm cache clean --force
npm install
```

## Getting Help

- Check [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for system design
- Check [DEVELOPMENT.md](./docs/DEVELOPMENT.md) for local setup
- Open a GitHub issue for bugs or questions
- Contact the Tap2 development team for support

## License

By contributing to Tap2 Wallet, you agree that your contributions will be licensed under the same license as the project.
