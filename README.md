# mist

Markdown in, shareable rendered URL out. Content lives in a secret gist; a static viewer on GitHub Pages renders it. Zero hosting infrastructure.

## Use

```sh
mist notes.md
pbpaste | mist
mist --filename spec.md --description "v2 spec" < spec.md
```

Viewer URL on stdout; the gist's own URL (edit, delete) on stderr.

## Auth

Fine-grained PAT: github.com/settings/personal-access-tokens -> Generate new token -> Account permissions -> Gists: read and write. No repository access.

Store it in the keychain (prompts for the secret):

```sh
security add-generic-password -a $USER -s mist -w # -a account, -s service, -w prompt for secret
```

`GITHUB_TOKEN` / `GH_TOKEN` env override the keychain. Forget with `security delete-generic-password -s mist`.

## Viewer

`src/viewer/` is a chrome-free markdown renderer served by GitHub Pages from `docs/` on main. The gist id travels in the URL fragment; the page fetches the gist from api.github.com client-side and renders it with vendored marked + DOMPurify.

```sh
./dev.sh # local viewer, live rebuild on save: http://mist-one-web.test/#<gist-id>
```

## Build

```sh
./build.sh # both artifacts via containerized bun: ./mist binary (src/cli) + docs/ (src/viewer); commit docs/
```

## Install

```sh
ln -s -f "$PWD/mist" ~/.local/bin/mist # -s symbolic, -f replace existing; rebuilds update it in place
```
