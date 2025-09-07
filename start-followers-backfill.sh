#!/bin/bash

# Followers Backfill Script
# This script starts both the worker and queue for followers backfill with nohup

echo "Starting followers backfill worker and queue..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Kill any existing processes
echo "Stopping any existing followers backfill processes..."
pkill -f "followersBackfill.worker.ts" 2>/dev/null || true
pkill -f "followersBackfill.queue.ts" 2>/dev/null || true

# Wait a moment for processes to stop
sleep 2

# Flush Redis to clear any existing jobs and data
echo "Flushing Redis database..."
redis-cli -p 16379 flushdb

# Start the worker in background
echo "Starting followers backfill worker..."
nohup bun run src/jobs/followersBackfill.worker.ts > logs/followers-worker.log 2>&1 &
WORKER_PID=$!

# Wait a moment for worker to start
sleep 3

# Start the queue (this will create the initial job and exit)
echo "Triggering followers backfill queue..."
bun run src/scripts/triggerFollowersBackfill.ts > logs/followers-queue.log 2>&1

echo "Followers backfill started successfully!"
echo "Worker PID: $WORKER_PID"
echo "Logs:"
echo "  Worker: logs/followers-worker.log" 
echo "  Queue: logs/followers-queue.log"
echo ""
echo "To monitor progress:"
echo "  tail -f logs/followers-worker.log"
echo ""
echo "To stop the worker:"
echo "  kill $WORKER_PID"
echo "  # OR"
echo "  pkill -f 'followersBackfill.worker.ts'"
echo ""
echo "Worker is running in background processing batches..."