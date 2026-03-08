import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const preview = spawn("cmd", ["/c", `npm run preview -- --host 127.0.0.1 --port ${PREVIEW_PORT}`], {
  stdio: ["ignore", "pipe", "pipe"],
});

preview.stdout.on("data", (d) => process.stdout.write(d));
preview.stderr.on("data", (d) => process.stderr.write(d));

try {
  console.log("probe:start");
  await sleep(5000);
  console.log("probe:launch-browser");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  console.log("probe:goto-auth");
  await page.goto(`${PREVIEW_URL}/auth`, { waitUntil: "networkidle", timeout: 30000 });
  console.log("probe:count-elements");
  const inputCount = await page.locator("input").count();
  const buttonCount = await page.locator("button").count();
  console.log("probe:screenshot");
  await page.screenshot({
    path: "docs/audit/system/evidence/wf_agency_ops_2026-03-07/screenshots/auth_probe_after_chunk_fix.png",
    fullPage: true,
  });

  console.log(JSON.stringify({ inputCount, buttonCount, errors }, null, 2));
  await browser.close();
} finally {
  console.log("probe:shutdown");
  if (!preview.killed) {
    preview.kill("SIGTERM");
  }
}
