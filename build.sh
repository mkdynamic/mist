#!/bin/sh
# self-contained darwin-arm64 binary at ./mist; run from the worktree root
container run --rm --volume "$PWD:/app" --workdir /app oven/bun:1.3 \
  bun build --compile --target=bun-darwin-arm64 ./src/main.ts --outfile mist || exit 1
rm -f .*.bun-build # stray compile temp; its zeroed perms break git add if left behind
