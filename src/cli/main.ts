#!/usr/bin/env bun
// mist: markdown in, shareable rendered URL out. Secret gist as the backend.

export {}; // module marker: file has top-level await but no imports

const SERVICE = "mist"; // keychain service name
const VIEWER = Bun.env.MIST_VIEWER ?? "https://mkdynamic.github.io/mist/";

function usage(code: number): never {
  console.error(
    `usage: mist [--filename <name>] [--description <text>] [<path>]\n` +
      `reads <path> (or stdin), creates a secret gist, prints the rendered URL`,
  );
  process.exit(code);
}

let filename: string | undefined;
let description = "";
let path: string | undefined;
const args = Bun.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;
  if (arg === "--help") usage(0);
  else if (arg === "--filename") filename = args[++i] ?? usage(1);
  else if (arg === "--description") description = args[++i] ?? usage(1);
  else if (arg.startsWith("--")) usage(1);
  else if (path === undefined) path = arg;
  else usage(1);
}

let content: string;
if (path !== undefined && path !== "-") {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    console.error(`mist: no such file: ${path}`);
    process.exit(1);
  }
  content = await file.text();
  filename ??= path.split("/").pop()!;
} else {
  content = await Bun.stdin.text();
  filename ??= "paste.md";
}
if (content.trim() === "") {
  console.error("mist: empty input");
  process.exit(1);
}

async function keychainRead(): Promise<string | null> {
  const proc = Bun.spawn(
    ["/usr/bin/security", "find-generic-password", "-s", SERVICE, "-w"], // -s service name, -w print only the password
    { stdout: "pipe", stderr: "ignore" },
  );
  const out = await new Response(proc.stdout).text();
  return (await proc.exited) === 0 ? out.trim() : null;
}

async function getToken(): Promise<string> {
  const env = Bun.env.GITHUB_TOKEN ?? Bun.env.GH_TOKEN;
  if (env) return env;
  const stored = await keychainRead();
  if (stored) return stored;
  console.error(
    "mist: no token. Create a fine-grained PAT (Account permissions -> Gists: read and write),\n" +
      `then store it: security add-generic-password -a $USER -s ${SERVICE} -w`,
  );
  process.exit(1);
}

const token = await getToken();
const res = await fetch("https://api.github.com/gists", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    description,
    public: false,
    files: { [filename]: { content } },
  }),
});
if (!res.ok) {
  const hint =
    res.status === 401
      ? ` (stale token? security delete-generic-password -s ${SERVICE})`
      : "";
  console.error(
    `mist: gist create failed: ${res.status} ${await res.text()}${hint}`,
  );
  process.exit(1);
}
const gist: any = await res.json();
console.log(`${VIEWER}#${gist.id}`);
console.error(`gist: ${gist.html_url}`); // management URL (edit, delete); stdout stays one pipeable line
