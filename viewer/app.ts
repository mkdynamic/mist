// mist viewer: renders a secret gist named by the URL fragment. Static page,
// zero content of its own; the gist id never reaches the Pages server (fragment).

import DOMPurify from "dompurify";
import { marked } from "marked";

const doc = document.getElementById("doc")!;

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

const files: any[] = Object.values(gist.files ?? {});
const file = files.find((f) => f.language === "Markdown") ?? files[0];
if (!file) fail("mist: gist has no files");

// API inlines content up to ~1MB; beyond that it flags truncated and we take the raw file
const text: string = file.truncated
  ? await (await fetch(file.raw_url)).text()
  : file.content;

document.title = file.filename;
doc.innerHTML = DOMPurify.sanitize(await marked.parse(text));
