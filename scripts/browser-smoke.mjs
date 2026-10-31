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
  let testedCombinations = 0;
  for (const id of ids) {
    await page.locator("#showAllTopics").click();
    await page.locator(`[data-quick="${id}"]`).click();
    const q1Count = await page.locator(".answer-option").count();
    for (let q1 = 0; q1 < q1Count; q1++) {
      for (let q2 = 0; q2 < 10; q2++) {
        if (q2 > 0) {
          const count = await page.locator(".answer-option").count();
          if (q2 >= count) break;
        }
        if (q1 > 0 || q2 > 0) {
          await page.locator("#backToCategories").click();
          await page.locator("#showAllTopics").click();
          await page.locator(`[data-quick="${id}"]`).click();
        }
        await page.locator(".answer-option").nth(q1).click();
        const q2Count = await page.locator(".answer-option").count();
        if (q2 >= q2Count) {
          await page.locator("#backToCategories").click();
          break;
        }
        await page.locator(".answer-option").nth(q2).click();
        const resultCard = page.locator("#resultCard");
        if (await resultCard.isHidden()) throw new Error(`${id}: result missing for answers ${q1},${q2}`);
        const resultText = await resultCard.innerText();
        if (!resultText.trim()) throw new Error(`${id}: empty result for answers ${q1},${q2}`);
        const priorityHeading = await resultCard.locator("h4").nth(1).innerText();
        const priorityList = await resultCard.locator("ul").nth(1).innerText();
        if (!priorityHeading || !priorityList.trim()) throw new Error(`${id}: tailored priority advice missing for answers ${q1},${q2}`);
        testedCombinations++;
        if (q2 === q2Count - 1) {
          await page.locator("#backToCategories").click();
        }
      }
    }
  }
  console.log(`PASS: all ${testedCombinations} answer combinations across 10 topics`);
  console.log("PASS: all results include tailored priority guidance");
  console.log("PASS: back-to-category action for each tested combination");

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
