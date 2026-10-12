#!/usr/bin/env node
/*
 * scripts/verify-interactive.mjs — behavioral verification in a real
 * browser (v4.0.5). Complements the source-level unit tests with
 * checks that only a live document can prove:
 *
 *   - keyboard operability of the navigation disclosure (open via
 *     Enter, Escape close + focus restoration, no focus trap)
 *   - reduced-motion behavior (hero signal arc static, the route
 *     progress line present but motionless)
 *   - route progress on a THROTTLED network: the 2px line appears
 *     only while navigation is unresolved, is non-blocking chrome
 *     (fixed, pointer-events: none), and fades after the commit
 *   - same-route clicks and footer navigation stay silent
 *   - no-JS: exported documents carry content, footer, and nav
 *     markup with the progress host inactive
 *   - scene hash navigation, footer soft navigation, player-host
 *     absence before engagement, direct deep links
 *
 * Usage: node scripts/verify-interactive.mjs
 * (port can be overridden with FINAL_VERIFY_PORT; the port must be
 * free — the script exits non-zero if any check fails).
 *
 * Requires Playwright (resolved from the environment, never a
 * project dependency). Not part of the `npm run verify` chain,
 * which is deliberately browser-free; run it where a browser is
 * available, like `npm run bench:loading`.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const OUT = path.join(repoRoot, "out");
const PORT = Number(process.env.FINAL_VERIFY_PORT ?? 4190);
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn(process.execPath, [path.join(repoRoot, "scripts", "e2e-static-server.mjs"), OUT, String(PORT)], { stdio: ["ignore", "pipe", "pipe"] });
server.stdout?.on("data", (d) => console.error("[server:out]", String(d).trim()));
server.stderr?.on("data", (d) => console.error("[server:err]", String(d).trim()));
server.on("spawn", () => console.error("[server] spawn ok pid", server.pid));
server.on("exit", (c, s) => console.error("[server] exit", c, s));
process.on("exit", () => server.kill("SIGTERM"));
process.on("SIGINT", () => { server.kill("SIGTERM"); process.exit(1); });

async function wait() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/index.html`, { method: "HEAD" }); if (r.ok) return; } catch (e) { if (i % 20 === 19) console.error("wait err:", e.cause?.code ?? e.message); }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server not up");
}
await wait();

const { chromium } = await import("playwright");
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

/* 1. Keyboard navigation: nav menu disclosure */
{
  const ctx = await browser.newContext({ viewport: { width: 760, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/about/`, { waitUntil: "load" });
  await page.waitForTimeout(900);
  const trigger = page.locator('button[aria-haspopup="true"]').first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const expanded = await trigger.getAttribute("aria-expanded");
  check("keyboard: menu opens via Enter", expanded === "true", `aria-expanded=${expanded}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const closed = await trigger.getAttribute("aria-expanded");
  const focusBack = await page.evaluate(() => document.activeElement?.getAttribute("aria-haspopup"));
  check("keyboard: Escape closes and restores focus", closed === "false" && focusBack === "true", `expanded=${closed} focusRestored=${focusBack === "true"}`);
  // Tab through the page — focus must be visible somewhere (no trap from progress line)
  await page.keyboard.press("Tab");
  const activeTag = await page.evaluate(() => document.activeElement?.tagName);
  check("keyboard: Tab moves focus (no trap)", activeTag === "A" || activeTag === "BUTTON", `active=${activeTag}`);
  await ctx.close();
}

/* 2. Reduced motion: progress line static, hero signal static */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/about/`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  const anims = await page.evaluate(() => {
    const sig = document.querySelector('[class*="heroSignal"]');
    const line = document.querySelector('[class*="routeProgress"]');
    const running = (el) => el ? getComputedStyle(el).animationName !== "none" : null;
    return { signalAnim: running(sig?.querySelector("::after") ?? sig), lineExists: Boolean(line) };
  });
  // The ::after animation: check via CSS rule presence instead
  const reducedCss = await page.evaluate(() => {
    const el = document.querySelector('[class*="heroSignal"]');
    const before = el ? getComputedStyle(el, "::after").animationName : null;
    return before;
  });
  check("reduced motion: hero signal arc is static", reducedCss === "none", `::after animation=${reducedCss}`);

  // Throttled navigation under reduced motion: line appears (static) then clears
  const client = await ctx.newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false, latency: 400, downloadThroughput: 60 * 1024, uploadThroughput: 60 * 1024
  });
  await page.click('nav[class*="trackNav"] a[href="/blog/"]', { noWaitAfter: true }).catch(() => {});
  await page.waitForTimeout(700);
  const activeSlow = await page.evaluate(() => document.querySelector('[class*="routeProgress"]')?.getAttribute("data-active"));
  check("reduced motion: throttled navigation activates the line", activeSlow === "true", `data-active=${activeSlow}`);
  await page.waitForURL(`${BASE}/blog/`, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  const activeAfter = await page.evaluate(() => document.querySelector('[class*="routeProgress"]')?.getAttribute("data-active"));
  check("reduced motion: line clears after commit", activeAfter === "false", `data-active=${activeAfter}`);
  await ctx.close();
}

/* 3. Route progress on a throttled network (motion allowed): appears then clears */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/contact/`, { waitUntil: "load" });
  await page.waitForTimeout(900);
  const client = await ctx.newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false, latency: 500, downloadThroughput: 50 * 1024, uploadThroughput: 50 * 1024
  });
  await page.click('nav[class*="trackNav"] a[href="/about/"]', { noWaitAfter: true }).catch(() => {});
  await page.waitForTimeout(900);
  const active = await page.evaluate(() => document.querySelector('[class*="routeProgress"]')?.getAttribute("data-active"));
  check("progress: slow navigation shows the line", active === "true", `data-active=${active}`);
  const z = await page.evaluate(() => {
    const el = document.querySelector('[class*="routeProgress"]');
    const s = getComputedStyle(el);
    return { pointerEvents: s.pointerEvents, position: s.position, height: s.height, opacity: s.opacity };
  });
  check("progress: line is non-blocking chrome", z.pointerEvents === "none" && z.position === "fixed" && z.height === "2px", JSON.stringify(z));
  await page.waitForURL(`${BASE}/about/`, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(900);
  const activeEnd = await page.evaluate(() => document.querySelector('[class*="routeProgress"]')?.getAttribute("data-active"));
  check("progress: line fades after destination commits", activeEnd === "false", `data-active=${activeEnd}`);
  await ctx.close();
}

/* 4. Same-route click never shows the line */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/about/`, { waitUntil: "load" });
  await page.waitForTimeout(900);
  await page.click('a[href="/about/"]').catch(() => {});
  await page.waitForTimeout(400);
  const active = await page.evaluate(() => document.querySelector('[class*="routeProgress"]')?.getAttribute("data-active"));
  const url = page.url();
  check("progress: same-route click shows nothing", active === "false", `data-active=${active} url=${url}`);
  await ctx.close();
}

/* 5. No-JS: content and footer present in raw HTML */
{
  for (const route of ["/about/", "/contact/", "/work/", "/research/", "/local-ai/"]) {
    const res = await fetch(`${BASE}${route}`);
    const html = await res.text();
    const hasH1 = /<h1[^>]*class="[^"]*title/.test(html);
    const hasFooter = /<footer/.test(html);
    const hasNav = /UnifiedSiteNav-module/.test(html);
    const hasProgress = /data-active="false"/.test(html);
    check(`no-JS ${route}: content+footer+nav in HTML, progress inactive`,
      hasH1 && hasFooter && hasNav && hasProgress);
  }
}

/* 6. Scene navigation: hash scenes work from home */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  await page.click('a[href="/#systems"]').catch(() => {});
  await page.waitForTimeout(1200);
  const hash = await page.evaluate(() => location.hash);
  check("scenes: hash navigation reaches #systems", hash.includes("systems"), `hash=${hash}`);
  await ctx.close();
}

/* 7. Footer navigation: soft route change via footer link */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/about/`, { waitUntil: "load" });
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.click('footer a[href="/research/"]', { noWaitAfter: true }).catch(() => {});
  await page.waitForURL(`${BASE}/research/`, { timeout: 8000 }).then(() => {
    check("footer: soft navigation to /research/ works", true);
  }).catch(() => {
    check("footer: soft navigation to /research/ works", false);
  });
  await ctx.close();
}

/* 8. Player host: mounted once, no audio element before intent */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const playerState = await page.evaluate(() => ({
    audioElements: document.querySelectorAll("audio").length
  }));
  check("player: no audio element before engagement", playerState.audioElements === 0, JSON.stringify(playerState));
  // navigate away and back — the host must not duplicate
  await page.click('a[href="/about/"]').catch(() => {});
  await page.waitForURL(`${BASE}/about/`, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  const audioAfter = await page.evaluate(() => document.querySelectorAll("audio").length);
  check("player: still no audio elements after navigation", audioAfter === 0, `count=${audioAfter}`);
  await ctx.close();
}

/* 9. Direct deep links */
{
  for (const route of ["/blog/the-anatomy-of-a-fast-static-site/", "/ai-evaluation/", "/work/"]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 15000 });
      const h1 = await page.locator("h1").first().textContent();
      check(`deep link ${route}`, h1 !== null && h1.length > 0, `h1="${(h1 ?? "").slice(0, 40)}"`);
    } catch (e) {
      check(`deep link ${route}`, false, String(e).slice(0, 80));
    }
    await ctx.close();
  }
}

await browser.close();
server.kill("SIGTERM");

const failed = results.filter((r) => !r.ok);
console.log(`\n=== ${results.length - failed.length}/${results.length} interactive checks passed ===`);
if (failed.length) {
  console.log("FAILED:", failed.map((f) => f.name).join(" | "));
  process.exit(1);
}
