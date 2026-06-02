#!/bin/bash
cd "$(dirname "$0")"
export $(cat .env.local | xargs)
npm run dev -- --port 3004
