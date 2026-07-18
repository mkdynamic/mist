#!/bin/sh
INSTANCE=mist-$(basename "$PWD") # repo-worktree; repo hardcoded

WEB_TAG=web
WEB_NAME=$INSTANCE-$WEB_TAG
WEB_HOST=$WEB_NAME.test
WEB_PORT=80 # bound by the container VM's own kernel as root; host privilege rules never consulted
WEB_URL=http://$WEB_HOST
WEB_COLOR=$(printf '\033[32m') # green

DIM=$(printf '\033[2m'); OFF=$(printf '\033[0m')
RULE=$DIM$(printf '%*s' $(($(tput cols)-1)) '' | sed 's/ /─/g')$OFF # full width, one col spare
echo "$RULE"
echo "${WEB_COLOR}[$WEB_TAG]$OFF  $WEB_URL/#<gist-id>"
echo "$RULE"
echo

trap 'container delete --force $WEB_NAME >/dev/null 2>&1; container network delete $INSTANCE >/dev/null 2>&1' INT TERM HUP EXIT

# fresh network resets the IP allocator; fixed start order then pins the service IP on every restart
container network delete "$INSTANCE" 2>/dev/null
container network create "$INSTANCE" >/dev/null || exit 1

container create --name "$WEB_NAME" --network "$INSTANCE" --volume "$PWD:/app" --workdir /app \
  --env PORT=$WEB_PORT \
  --env FORCE_COLOR=1 \
  oven/bun:1.3 bun --watch --no-clear-screen src/viewer/serve.ts >/dev/null || exit 1

container start "$WEB_NAME" >/dev/null
dscacheutil -flushcache # names register at start; clear negatives cached by any lookup that raced the boot

container logs --follow -n 1000 "$WEB_NAME" 2>&1 | sed "s/^/${WEB_COLOR}[$WEB_TAG]$OFF /" &

wait
