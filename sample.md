# pulse

A tiny task scheduler for Bun. One file, no dependencies, no daemon. You declare jobs as plain functions with a cadence, and `pulse` runs them in-process with jittered timers so a fleet of instances never thunders the same endpoint at once.

This started as a shell loop calling `curl` every minute. Then the loop needed backoff, then overlap protection, then observability, and at some point the honest move was to admit it had become software.

## Why not cron

Cron is fine until the job needs context. The things that pushed us off it:

- Jobs share nothing. Every invocation cold-starts its config, connections, and caches.
- Failure handling is DIY. A crashed job is silent unless you wire up mail, and nobody wires up mail.
- Overlap is unmanaged. A slow run and the next tick happily stampede each other.
- The schedule lives outside the code it schedules, so they drift apart.

> The schedule is part of the program. Treating it as infrastructure config is how you end up with a job that fires hourly for a feature you deleted in March.

That said, cron is still the right tool for host-level concerns. `pulse` is for jobs that belong to an application.

## Install

```sh
bun add pulse --exact
```

## Usage

Declare jobs, then start the loop. The scheduler owns process lifetime; SIGTERM drains in-flight runs before exit.

```ts
import { pulse, every } from "pulse";

const jobs = pulse({
  heartbeat: every("30s", async () => {
    await fetch("https://status.internal/ping", { method: "POST" });
  }),

  reindex: every("15m", { jitter: 0.2, overlap: "skip" }, async (ctx) => {
    const stale = await ctx.db.query("SELECT id FROM docs WHERE dirty");
    for (const row of stale) await reindexDoc(row.id);
    return { indexed: stale.length };
  }),
});

await jobs.start();
```

Each job gets a `ctx` with a logger, an abort signal, and whatever you passed to `pulse()` as shared state. Return values are recorded as the run's result and show up in the stats endpoint.

### Cadence strings

| String  | Meaning               | Jitter default |
| ------- | --------------------- | -------------- |
| `"30s"` | every thirty seconds  | 10%            |
| `"15m"` | every fifteen minutes | 10%            |
| `"2h"`  | every two hours       | 5%             |
| `"@04"` | daily at 04:00 local  | 15 min         |

Jitter is a fraction of the interval, drawn once per process so an instance keeps a stable phase. Set `jitter: 0` if you genuinely need synchronized fire, and be sure that you do.

### Overlap policies

1. `"skip"` -- if the previous run is still going, drop this tick. The default, and right for idempotent sweeps.
2. `"queue"` -- run immediately after the current one finishes. At most one queued; further ticks collapse.
3. `"concurrent"` -- just run it. You are on your own.

## Rendering status in a dashboard

The stats endpoint returns per-job history that drops straight into a React table. This is roughly the whole widget:

```tsx
export function JobTable({ stats }: { stats: JobStats[] }) {
  return (
    <table>
      <tbody>
        {stats.map((job) => (
          <tr key={job.name} className={job.lastRun.ok ? "ok" : "failed"}>
            <td>{job.name}</td>
            <td>{job.cadence}</td>
            <td title={job.lastRun.error ?? ""}>
              {job.lastRun.ok ? "✓" : "✗"} {formatAgo(job.lastRun.at)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Configuration

Everything tunable lives in one object, serializable so it can come from a file:

```json
{
  "timezone": "America/Los_Angeles",
  "maxHistoryPerJob": 200,
  "stats": { "port": 9182, "path": "/pulse" },
  "onError": "log",
  "shutdownGraceMs": 30000
}
```

A note on `timezone`: interval jobs (`"30s"`, `"2h"`) do not care, but `@`-anchored jobs resolve against it. If you run instances in multiple regions, pin this explicitly or your "daily at 4am" job becomes "daily at four different times."

## Migrating from the shell loop

The diff that replaced our original setup, for flavor:

```diff
-*/1 * * * * curl -fsS https://status.internal/ping || echo "ping failed" | mail -s alert ops@example.com
+heartbeat: every("30s", async () => {
+  await fetch("https://status.internal/ping", { method: "POST" });
+}),
```

One line of crontab became three lines of TypeScript, and in exchange: retries, jitter, a signal on shutdown, and a `/pulse` endpoint the dashboard polls instead of a mail alias nobody reads.

---

Questions and patches welcome. The whole thing is ~400 lines; read the source before opening an issue, it is genuinely faster than the docs.
