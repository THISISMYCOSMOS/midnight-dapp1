// SPDX-License-Identifier: Apache-2.0
//
// 디자인 규칙 검사. 기준은 사용자 확정 목업(docs/mockup.html)에서 실측한 값이다:
//   색     무채색 5 + 유채색 1  (#ffffff #1a1a1a #6b6b6b #a0a0a0 #e5e5e5 + #2f6f5e)
//   타이포 3단계               (32 / 15 / 13)
//   간격   4단계               (8 / 16 / 32 / 64)
// AGENTS.md §2.6: 이모지 금지, 그라데이션 금지, 위계는 크기가 아니라 웨이트·여백으로.
//
// 규칙을 새로 만드는 파일이 아니다. 이미 확정된 규칙에서 벗어난 지점을 세는 파일이다.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PALETTE = ["#ffffff", "#1a1a1a", "#6b6b6b", "#a0a0a0", "#e5e5e5", "#2f6f5e"];
const TYPE_SCALE = [32, 15, 13];
const SPACE_SCALE = [0, 8, 16, 32, 64];

const src = "src";
const files = readdirSync(src, { recursive: true })
  .filter((name) => /\.(tsx?|css)$/.test(name))
  .map((name) => join(src, name));

const findings = [];
const add = (file, line, rule, detail) =>
  findings.push({ file, line, rule, detail });

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((text, index) => {
    const line = index + 1;

    for (const color of text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
      if (!PALETTE.includes(color.toLowerCase())) {
        add(file, line, "팔레트 밖 색", color);
      }
    }

    for (const size of text.match(/font-size: *([0-9.]+)px/g) ?? []) {
      const value = Number.parseFloat(size.match(/([0-9.]+)px/)[1]);
      if (!TYPE_SCALE.includes(value)) {
        add(file, line, "타이포 스케일 밖", `${value}px`);
      }
    }

    for (const space of text.match(
      /(?:margin|padding|gap)[a-z-]*: *([^;]+)/g,
    ) ?? []) {
      for (const px of space.match(/-?[0-9.]+px/g) ?? []) {
        const value = Math.abs(Number.parseFloat(px));
        if (!SPACE_SCALE.includes(value)) {
          add(file, line, "간격 스케일 밖", `${space.split(":")[0]}: ${px}`);
        }
      }
    }

    if (/linear-gradient|radial-gradient/.test(text)) {
      add(file, line, "그라데이션", text.trim().slice(0, 40));
    }
    if (/box-shadow: *(?!none)/.test(text)) {
      add(file, line, "그림자", text.trim().slice(0, 40));
    }
    for (const emoji of text.match(/\p{Extended_Pictographic}/gu) ?? []) {
      add(file, line, "이모지", emoji);
    }
  });
}

const byRule = new Map();
for (const finding of findings) {
  byRule.set(finding.rule, [...(byRule.get(finding.rule) ?? []), finding]);
}

if (findings.length === 0) {
  console.log("디자인 규칙 위반 0건");
} else {
  console.log(`디자인 규칙 위반 ${findings.length}건\n`);
  for (const [rule, items] of byRule) {
    const values = new Map();
    for (const item of items) {
      values.set(item.detail, (values.get(item.detail) ?? 0) + 1);
    }
    console.log(`[${rule}] ${items.length}건`);
    for (const [value, count] of [...values].sort((a, b) => b[1] - a[1])) {
      const where = items
        .filter((item) => item.detail === value)
        .slice(0, 4)
        .map((item) => `${item.file}:${item.line}`)
        .join(", ");
      console.log(`  ${value} ×${count} — ${where}`);
    }
    console.log("");
  }
}

process.exit(findings.length === 0 ? 0 : 1);
