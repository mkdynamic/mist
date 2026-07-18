#!/bin/sh
# builds both artifacts; run from the worktree root:
#   ./mist  self-contained darwin-arm64 CLI binary
#   docs/   viewer bundle (GitHub Pages root; marked + dompurify vendored)
rm -rf docs || exit 1
container run --rm --volume "$PWD:/app" --workdir /app oven/bun:1.3 sh -c \
  "bun build --compile --target=bun-darwin-arm64 ./src/cli/main.ts --outfile mist \
   && bun build src/viewer/index.html --outdir docs --minify" || exit 1
rm -f .*.bun-build # stray compile temp; its zeroed perms break git add if left behind
touch docs/.nojekyll # serve as-is, skip Jekyll
