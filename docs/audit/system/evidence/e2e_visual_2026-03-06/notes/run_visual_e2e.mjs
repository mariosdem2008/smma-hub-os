import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const base = path.resolve('docs/audit/system/evidence/e2e_visual_2026-03-06');
const unauthDir = path.join(base, 'screenshots', 'unauth');
const authDir = path.join(base, 'screenshots', 'auth');
const logsDir = path.join(base, 'logs');

const BASE_URL = process.env.VISUAL_E2E_BASE_URL || 'http://127.0.0.1:4173';
const now = new Date();
const email = `codex.audit.${Date.now()}@example.com`;
const password = 'Smmahub123!';
const fullName = 'Codex Audit User';

const routesUnauth = [
  '/', '/auth', '/forgot-password', '/reset-password', '/pricing', '/terms', '/privacy',
  '/bootstrap', '/welcome', '/select-agency', '/create-agency', '/invitations',
  '/dashboard', '/clients', '/messages', '/team', '/billing', '/settings',
  '/agency/ai-setup', '/ai/admin', '/ai/onboarding/agency',
  '/client/portal', '/client/login/demo', '/client/accept-invite', '/client/reset-password', '/client/forgot-password/demo'
];

const routesAuth = [
  '/bootstrap', '/welcome', '/create-agency', '/invitations', '/ai/onboarding/agency',
  '/dashboard', '/clients', '/messages', '/team', '/billing', '/billing/overview', '/settings', '/agency/ai-setup', '/ai/admin'
];

function safeName(route) {
  return route.replace(/^\//, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'root';
}

const findings = [];
const consoleErrors = [];
const requestFailures = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
    }
  });
  page.on('requestfailed', (req) => {
    requestFailures.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText ?? 'unknown' });
  });

  for (const route of routesUnauth) {
    const url = `${BASE_URL}${route}`;
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(500);
      const shot = path.join(unauthDir, `${safeName(route)}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      findings.push({ phase: 'unauth', route, finalUrl: page.url(), status: resp?.status() ?? null, screenshot: shot, ok: true });
    } catch (e) {
      findings.push({ phase: 'unauth', route, finalUrl: page.url(), status: null, screenshot: null, ok: false, error: String(e) });
    }
  }

  // Signup + login attempt
  const authUrl = `${BASE_URL}/auth`;
  try {
    await page.goto(authUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.getByRole('button', { name: 'Create an account' }).click();
    await page.locator('#fullName').fill(fullName);
    await page.locator('#signupEmail').fill(email);
    await page.locator('#signupPassword').fill(password);
    await page.locator('#confirmPassword').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(authDir, 'signup_result.png'), fullPage: true });
    findings.push({ phase: 'auth-flow', route: '/auth (signup)', finalUrl: page.url(), status: null, screenshot: path.join(authDir, 'signup_result.png'), ok: true });
  } catch (e) {
    findings.push({ phase: 'auth-flow', route: '/auth (signup)', finalUrl: page.url(), status: null, screenshot: null, ok: false, error: String(e) });
  }

  try {
    await page.goto(authUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(authDir, 'login_result.png'), fullPage: true });
    findings.push({ phase: 'auth-flow', route: '/auth (login)', finalUrl: page.url(), status: null, screenshot: path.join(authDir, 'login_result.png'), ok: true });
  } catch (e) {
    findings.push({ phase: 'auth-flow', route: '/auth (login)', finalUrl: page.url(), status: null, screenshot: null, ok: false, error: String(e) });
  }

  for (const route of routesAuth) {
    const url = `${BASE_URL}${route}`;
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(600);
      const shot = path.join(authDir, `${safeName(route)}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      findings.push({ phase: 'auth-routes', route, finalUrl: page.url(), status: resp?.status() ?? null, screenshot: shot, ok: true });
    } catch (e) {
      findings.push({ phase: 'auth-routes', route, finalUrl: page.url(), status: null, screenshot: null, ok: false, error: String(e) });
    }
  }

  fs.writeFileSync(path.join(logsDir, 'run_meta.json'), JSON.stringify({ at: now.toISOString(), baseUrl: BASE_URL, signupEmail: email, signupPassword: password }, null, 2));
  fs.writeFileSync(path.join(logsDir, 'findings.json'), JSON.stringify(findings, null, 2));
  fs.writeFileSync(path.join(logsDir, 'console_errors.json'), JSON.stringify(consoleErrors, null, 2));
  fs.writeFileSync(path.join(logsDir, 'request_failures.json'), JSON.stringify(requestFailures, null, 2));

  const md = [
    '# Visual E2E Run Summary',
    '',
    `Run at: ${now.toISOString()}`,
    `Base URL: ${BASE_URL}`,
    `Signup email used: ${email}`,
    '',
    '## Route Results',
    '',
    '| Phase | Route | Final URL | Status | OK | Screenshot |',
    '|---|---|---|---:|---|---|',
    ...findings.map(f => `| ${f.phase} | ${f.route} | ${f.finalUrl} | ${f.status ?? ''} | ${f.ok ? 'yes' : 'no'} | ${f.screenshot ? f.screenshot.replace(/\\/g,'/') : ''} |`),
    '',
    `Console errors captured: ${consoleErrors.length}`,
    `Request failures captured: ${requestFailures.length}`,
  ].join('\n');
  fs.writeFileSync(path.join(base, 'notes', 'visual_e2e_summary.md'), md);

  await browser.close();
})();
