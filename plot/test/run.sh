#!/bin/sh
# Run every core test under Node.  Usage: test/run.sh [name]
cd "$(dirname "$0")/.."
mkdir -p build/test
for f in test/*.test.ts; do
  n=$(basename "$f" .test.ts)
  [ -n "$1" ] && [ "$1" != "$n" ] && continue
  npx esbuild "$f" --bundle --platform=node --log-level=error --outfile=build/test/$n.js && node build/test/$n.js || exit 1
done
