#!/bin/sh
# bundles the viewer (marked + dompurify vendored) into docs/ (GitHub Pages root); run from the worktree root
rm -rf docs || exit 1
container run --rm --volume "$PWD:/app" --workdir /app oven/bun:1.3 \
  bun build viewer/index.html --outdir docs --minify || exit 1
touch docs/.nojekyll # serve as-is, skip Jekyll
