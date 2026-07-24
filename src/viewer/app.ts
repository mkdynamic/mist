// mist viewer: renders a secret gist named by the URL fragment. Static page,
// zero content of its own; the gist id never reaches the Pages server (fragment).

import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini"; // also covers toml
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml"; // also covers html
import yaml from "highlight.js/lib/languages/yaml";
import { marked } from "marked";

const languages = {
  bash,
  css,
  diff,
  go,
  ini,
  javascript,
  json,
  markdown,
  python,
  rust,
  sql,
  typescript,
  xml,
  yaml,
};
for (const [name, lang] of Object.entries(languages))
  hljs.registerLanguage(name, lang);

const doc = document.getElementById("doc")!;

// fragment-only navigation fires no page load; the render below runs once, so reload
addEventListener("hashchange", () => location.reload());

// lucide outlines, stroke inherits button color
const icon = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const icons = {
  copy: icon(
    '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  ),
  check: icon('<path d="M20 6 9 17l-5-5"/>'),
  cross: icon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  wrap: icon(
    '<line x1="3" x2="21" y1="6" y2="6"/><path d="M3 12h15a3 3 0 1 1 0 6h-4"/><polyline points="16 16 14 18 16 20"/><line x1="3" x2="10" y1="18" y2="18"/>',
  ),
  sun: icon(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  ),
  moon: icon('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
};

// theme: plain light/dark flip; system is the invisible default. The icon shows
// what a click gives you. Choosing what the OS already prefers clears the
// override, so untouched (or re-matched) pages keep following system.
type Mode = "light" | "dark";
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const storedTheme = localStorage.getItem("mist-theme");
let override: Mode | null =
  storedTheme === "light" || storedTheme === "dark" ? storedTheme : null;

const toggle = document.createElement("button");
toggle.className = "themetoggle";
function applyTheme() {
  if (override) document.documentElement.dataset.theme = override;
  else delete document.documentElement.dataset.theme;
  const current: Mode = override ?? (systemDark.matches ? "dark" : "light");
  const next: Mode = current === "dark" ? "light" : "dark";
  toggle.innerHTML = next === "dark" ? icons.moon : icons.sun;
  toggle.title = `switch to ${next}`;
  toggle.setAttribute("aria-label", `switch to ${next} theme`);
}
applyTheme();
toggle.addEventListener("click", () => {
  const current: Mode = override ?? (systemDark.matches ? "dark" : "light");
  const next: Mode = current === "dark" ? "light" : "dark";
  override = next === (systemDark.matches ? "dark" : "light") ? null : next;
  if (override) localStorage.setItem("mist-theme", override);
  else localStorage.removeItem("mist-theme");
  applyTheme();
});
systemDark.addEventListener("change", applyTheme); // keep icon honest while following system
document.body.append(toggle);

function fail(message: string): never {
  doc.textContent = message;
  throw new Error(message);
}

const id = location.hash.slice(1);
if (!/^[0-9a-f]{16,}$/.test(id)) fail("mist: no gist id in URL fragment");

const res = await fetch(`https://api.github.com/gists/${id}`);
if (!res.ok)
  fail(
    res.status === 404
      ? "mist: gist not found"
      : `mist: gist fetch failed (${res.status})`,
  );
const gist: any = await res.json();

// render only these accounts' gists: keeps the public viewer useless as a host for anyone else's content
const OWNERS = ["mkdynamic", "calebelston"];
if (!OWNERS.includes(gist.owner?.login))
  fail("mist: gist owner not allowed");

const files: any[] = Object.values(gist.files ?? {});
const file = files.find((f) => f.language === "Markdown") ?? files[0];
if (!file) fail("mist: gist has no files");

// API inlines content up to ~1MB; beyond that it flags truncated and we take the raw file
const text: string = file.truncated
  ? await (await fetch(file.raw_url)).text()
  : file.content;

document.title = file.filename;
doc.innerHTML = DOMPurify.sanitize(await marked.parse(text));

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // http dev origin has no clipboard API; selection fallback
    const ta = document.createElement("textarea");
    ta.value = value;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

for (const code of doc.querySelectorAll<HTMLElement>("pre > code")) {
  const lang = /language-([\w-]+)/.exec(code.className)?.[1];
  if (lang && hljs.getLanguage(lang)) hljs.highlightElement(code);

  // controls live on a wrapper, not the pre: the pre scrolls horizontally when unwrapped
  const pre = code.parentElement as HTMLElement;
  const block = document.createElement("div");
  block.className = "codeblock";
  pre.replaceWith(block);
  block.append(pre);

  const bar = document.createElement("div");
  bar.className = "codebar";

  const copy = document.createElement("button");
  copy.setAttribute("aria-label", "copy code");
  copy.innerHTML = icons.copy;
  copy.addEventListener("click", async () => {
    copy.innerHTML = (await copyText(code.textContent ?? ""))
      ? icons.check
      : icons.cross;
    setTimeout(() => (copy.innerHTML = icons.copy), 1200);
  });
  bar.append(copy);

  // wrap toggle only where it matters: does the block overflow when unwrapped?
  pre.classList.add("nowrap");
  const overflows = pre.scrollWidth > pre.clientWidth;
  pre.classList.remove("nowrap");
  if (overflows) {
    const wrap = document.createElement("button");
    wrap.setAttribute("aria-label", "toggle soft wrap");
    wrap.setAttribute("aria-pressed", "true"); // soft-wrap is the default
    wrap.innerHTML = icons.wrap;
    wrap.addEventListener("click", () => {
      wrap.setAttribute(
        "aria-pressed",
        String(!pre.classList.toggle("nowrap")),
      );
    });
    bar.append(wrap);
  }

  block.append(bar);
}
