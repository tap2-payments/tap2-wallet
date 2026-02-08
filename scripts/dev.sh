#!/bin/bash

# Tap2 Wallet - Development Server Script
# This script starts all development servers in parallel

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

# Check if running in tmux or screen
if [ -z "$TMUX" ] && [ -z "$STY" ]; then
    print_warning "Warning: For best experience, run this script in tmux or a terminal multiplexer."
    print_warning "Otherwise, you'll only see the last server's output."
    echo ""
fi

print_header "Tap2 Wallet - Development Servers"
echo ""
echo "Starting all development servers..."
echo ""

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Check if .env files exist
check_env_files() {
    if [ ! -f "backend/.env" ]; then
        print_warning "Warning: backend/.env not found. Run ./scripts/setup.sh first."
    fi
    if [ ! -f "mobile/.env" ]; then
        print_warning "Warning: mobile/.env not found. Run ./scripts/setup.sh first."
    fi
}

# Check for required ports
check_ports() {
    # Backend uses 8787 (Wrangler default)
    # Marketing uses 4321 (Astro default)
    # Mobile uses 8081 (Expo default)
    echo "Checking for available ports..."
    ports_in_use=()

    if lsof -i:8787 -sTCP:LISTEN -t >/dev/null 2>&1; then
        ports_in_use+=("8787 (Backend)")
    fi
    if lsof -i:4321 -sTCP:LISTEN -t >/dev/null 2>&1; then
        ports_in_use+=("4321 (Marketing)")
    fi
    if lsof -i:8081 -sTCP:LISTEN -t >/dev/null 2>&1; then
        ports_in_use+=("8081 (Expo/Mobile)")
    fi

    if [ ${#ports_in_use[@]} -gt 0 ]; then
        print_warning "The following ports are already in use:"
        for port in "${ports_in_use[@]}"; do
            echo "  - $port"
        done
        echo ""
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

check_env_files
check_ports

# Start servers
echo "Starting servers..."
echo ""

# Backend (Cloudflare Workers)
print_header "Backend API (http://localhost:8787)"
echo ""
cd "$PROJECT_ROOT/backend"
npm run dev &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
echo ""

# Wait a moment for backend to start
sleep 2

# Marketing site (Astro)
print_header "Marketing Site (http://localhost:4321)"
echo ""
cd "$PROJECT_ROOT/marketing"
npm run dev &
MARKETING_PID=$!
echo "Marketing PID: $MARKETING_PID"
echo ""

# Wait a moment for marketing to start
sleep 2

# Mobile (Expo)
print_header "Mobile App (http://localhost:8081)"
echo ""
cd "$PROJECT_ROOT/mobile"
npm start &
MOBILE_PID=$!
echo "Mobile PID: $MOBILE_PID"
echo ""

# Save PIDs for cleanup
echo "$BACKEND_PID" "$MARKETING_PID" "$MOBILE_PID" > /tmp/tap2-wallet-dev-pids

echo ""
print_success "All servers started!"
echo ""
echo "================================"
echo "Services running:"
echo "================================"
echo "  Backend API:    http://localhost:8787"
echo "  Marketing:      http://localhost:4321"
echo "  Mobile Expo:    http://localhost:8081"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Handle cleanup on exit
cleanup() {
    echo ""
    print_warning "Stopping all servers..."
    kill $BACKEND_PID $MARKETING_PID $MOBILE_PID 2>/dev/null
    rm -f /tmp/tap2-wallet-dev-pids
    print_success "All servers stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for any process to exit
wait
