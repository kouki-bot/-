import { chromium } from "playwright";
import { spawn } from "node:child_process";

const server = spawn("python3", ["-m", "http.server", "4173", "--bind", "127.0.0.1"], {
  stdio: "ignore"
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch("http://127.0.0.1:4173/");
      if (response.ok) { ready = true; break; }
    } catch {}
    await sleep(250);
  }
  if (!ready) throw new Error("Local preview server did not start");

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });

  const categories = {
    home: 3, money: 2, shopping: 1, work: 2, procedures: 1, trouble: 1
  };
  for (const [category, count] of Object.entries(categories)) {
    await page.locator(`.category-card[data-category="${category}"]`).click();
    const visible = await page.locator(".popular-item:visible").count();
    if (visible !== count) throw new Error(`Category ${category}: expected ${count}, got ${visible}`);
  }
  await page.locator("#showAllTopics").click();
  if (await page.locator(".popular-item:visible").count() !== 10) {
    throw new Error("Show-all did not restore all 10 topics");
  }

  const ids = ["rent","rentincrease","noise","refund","unknowncharge","subscription","resign","unemployment","moving","leak"];
  for (const id of ids) {
    await page.locator(`[data-quick="${id}"]`).click();
    if (await page.locator("#guidePanel").isHidden()) throw new Error(`${id}: guide did not open`);
    for (let step = 0; step < 2; step++) {
      const answers = page.locator(".answer-option");
      if (await answers.count() < 2) throw new Error(`${id}: missing answer options at step ${step + 1}`);
      await answers.first().click();
    }
    if (await page.locator("#resultCard").isHidden()) throw new Error(`${id}: result did not render`);
    if (!(await page.locator("#resultCard").innerText()).trim()) throw new Error(`${id}: empty result`);
    await page.locator("#backToCategories").click();
    if (!(await page.locator("#guidePanel").isHidden())) throw new Error(`${id}: back action failed`);
  }

  await page.locator('[data-quick="rent"]').click();
  await page.locator("#languageSelect").selectOption("en");
  const englishQuestion = await page.locator("#questionTitle").innerText();
  if (!englishQuestion || /退去|状況/.test(englishQuestion)) throw new Error("English question did not switch");
  await page.locator(".answer-option").first().click();
  await page.locator(".answer-option").first().click();
  await page.locator("#languageSelect").selectOption("zh");
  const result = await page.locator("#resultCard").innerText();
  if (!result.includes("您的回答")) throw new Error("Chinese result heading did not switch");

  if (pageErrors.length) throw new Error("Browser errors: " + pageErrors.join(" | "));
  console.log("PASS: six category filters and show-all");
  console.log("PASS: all 10 topics open, answer and render results");
  console.log("PASS: back-to-category action");
  console.log("PASS: language switch in question and result states");
  console.log("PASS: no uncaught browser errors");
} finally {
  if (browser) await browser.close();
  server.kill();
}
