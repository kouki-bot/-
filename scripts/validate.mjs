import fs from "node:fs";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const html=fs.readFileSync("index.html","utf8");
const js=fs.readFileSync("script.js","utf8");
const css=fs.readFileSync("style.css","utf8");
const ids=["rent","rentincrease","noise","refund","unknowncharge","subscription","resign","unemployment","moving","leak"];
const languages=["ja","en","zh","vi","ko"];
const categories={home:["rent","rentincrease","noise"],money:["unknowncharge","subscription"],shopping:["refund"],work:["resign","unemployment"],procedures:["moving"],trouble:["leak"]};
const syntax=spawnSync("node",["--check","script.js"],{encoding:"utf8"});
assert.equal(syntax.status,0,syntax.stderr||"script.js syntax check failed");
const quick=[...html.matchAll(/data-quick="([^"]+)"[^>]*data-topic-category="([^"]+)"/g)].map(([,id,category])=>({id,category}));
assert.equal(quick.length,10,"Expected exactly 10 topic links");
assert.deepEqual(quick.map(x=>x.id).sort(),[...ids].sort(),"Topic IDs mismatch");
for(const [category,expected] of Object.entries(categories)){
 const actual=quick.filter(x=>x.category===category).map(x=>x.id).sort();
 assert.deepEqual(actual,[...expected].sort(),`Category mapping mismatch: ${category}`);
}
for(const id of ids) assert.ok(html.includes(`data-i18n="topic_${id}"`),`Missing HTML i18n binding: ${id}`);
for(let i=0;i<languages.length;i++){
 const lang=languages[i], start=js.indexOf(`${lang}:{`);
 assert.ok(start>=0,`Missing locale: ${lang}`);
 const next=languages.slice(i+1).map(l=>js.indexOf(`${l}:{`,start+1)).filter(x=>x>start).sort((a,b)=>a-b)[0]??js.length;
 const locale=js.slice(start,next);
 for(const id of ids) assert.ok(locale.includes(`topic_${id}:`),`Missing topic_${id} in ${lang}`);
}
assert.match(css,/\[hidden\]\s*\{[^}]*display\s*:\s*none/i,"Missing hidden CSS rule");
assert.ok(html.includes('id="showAllTopics"'),"Missing show-all control");
assert.ok(js.includes('$("#showAllTopics").addEventListener'),"Missing show-all handler");
console.log("PASS: JavaScript syntax");
console.log("PASS: 10 topic links and IDs");
console.log("PASS: 6 category mappings");
console.log("PASS: 5 locale topic labels");
console.log("PASS: hidden CSS and show-all control");
