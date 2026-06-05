#!/usr/bin/env node

const baseUrl = (process.env.ACE_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const cronSecret = process.env.CRON_SECRET || "";
const intervalMs = Number.parseInt(process.env.INDEXING_WORKER_INTERVAL_MS || "30000", 10);
const once = process.argv.includes("--once");

async function drainOnce() {
  const response = await fetch(`${baseUrl}/api/documents/drain`, {
    headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : undefined,
    method: "POST",
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Drain failed ${response.status}: ${text}`);
  }

  const payload = JSON.parse(text);
  const stamp = new Date().toISOString();
  console.log(
    `[${stamp}] scanned=${payload.scanned} processed=${payload.processed} failed=${payload.failed}`,
  );

  for (const item of payload.items ?? []) {
    console.log(`  - ${item.ok ? "ok" : "error"} ${item.title}${item.error ? `: ${item.error}` : ""}`);
  }
}

async function main() {
  console.log(`ACE indexing worker -> ${baseUrl}`);
  if (!cronSecret) {
    console.warn("WARN: CRON_SECRET no configurado; el endpoint requerirá sesión DEC/admin.");
  }

  if (once) {
    await drainOnce();
    return;
  }

  for (;;) {
    try {
      await drainOnce();
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ${error instanceof Error ? error.message : error}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
