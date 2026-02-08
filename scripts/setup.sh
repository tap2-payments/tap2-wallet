#!/bin/bash
set -e

# Tap2 Wallet - One-Time Setup Script
# This script sets up all workspaces for local development

echo "================================"
echo "Tap2 Wallet - Setup Script"
echo "================================"
echo ""

# Check for required tools
echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js 18+ is required. Current version: $(node -v)"
    exit 1
fi
echo "Node.js: $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed."
    exit 1
fi
echo "npm: $(npm -v)"

# Check for Cloudflare Wrangler (for backend)
if ! command -v wrangler &> /dev/null; then
    echo "Warning: Wrangler CLI not found. Installing globally..."
    npm install -g wrangler
fi
echo "Wrangler: $(wrangler --version | head -n1 || echo 'not found')"

echo ""
echo "================================"
echo "Installing dependencies..."
echo "================================"

# Root dependencies
echo "Installing root dependencies..."
npm install

# Backend
echo ""
echo "Setting up backend..."
cd backend
if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Please edit backend/.env with your configuration"
else
    echo ".env already exists, skipping..."
fi

echo "Installing backend dependencies..."
npm install

# Setup local D1 database
echo "Creating local D1 database..."
wrangler d1 execute tap2-wallet-db --local --command "SELECT name FROM sqlite_master WHERE type='table';" > /dev/null 2>&1 || \
    wrangler d1 create tap2-wallet-db --local || true

echo "Running database migrations..."
npm run db:generate 2>/dev/null || echo "No migrations to run"

cd ..

# Mobile
echo ""
echo "Setting up mobile..."
cd mobile
if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Please edit mobile/.env with your configuration"
else
    echo ".env already exists, skipping..."
fi

echo "Installing mobile dependencies..."
npm install

# Check for Expo CLI
if ! command -v expo &> /dev/null; then
    echo "Installing Expo CLI globally..."
    npm install -g @expo/cli
fi

echo "Expo: $(expo --version || echo 'not found')"

cd ..

# Marketing
echo ""
echo "Setting up marketing site..."
cd marketing
echo "Installing marketing dependencies..."
npm install
cd ..

echo ""
echo "================================"
echo "Setup complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Configure environment variables:"
echo "   - backend/.env"
echo "   - mobile/.env"
echo ""
echo "2. Start development servers:"
echo "   ./scripts/dev.sh"
echo ""
echo "3. Or start individually:"
echo "   - Backend:  cd backend && npm run dev"
echo "   - Mobile:   cd mobile && npm start"
echo "   - Marketing: cd marketing && npm run dev"
echo ""
