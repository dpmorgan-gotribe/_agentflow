#!/bin/bash
# kill-all.sh - Emergency shutdown for Aigentflow
# Usage: ./scripts/kill-all.sh

echo -e "\033[31mAigentflow Emergency Shutdown\033[0m"
echo -e "\033[31m==============================\033[0m"

# Kill Node.js processes matching our apps
echo -e "\n\033[33mKilling Node.js processes...\033[0m"
pkill -f "aigentflow" 2>/dev/null
pkill -f "vite.*apps/web" 2>/dev/null
pkill -f "nest.*apps/api" 2>/dev/null
pkill -f "turbo.*dev" 2>/dev/null

# Kill by port (API: 3001, Vite: 5173)
echo -e "\033[33mFreeing ports 3001 and 5173...\033[0m"
for port in 3001 5173; do
    pid=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo "Killing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null
    fi
done

# On macOS/Linux, also kill any orphaned node processes
if command -v pgrep &> /dev/null; then
    node_pids=$(pgrep -f "node.*dist/main" 2>/dev/null)
    if [ -n "$node_pids" ]; then
        echo -e "\033[33mKilling orphaned Node processes...\033[0m"
        echo "$node_pids" | xargs kill -9 2>/dev/null
    fi
fi

echo -e "\n\033[32mAll Aigentflow processes terminated.\033[0m"
echo -e "\033[36mYou can now restart with: pnpm dev\033[0m"
