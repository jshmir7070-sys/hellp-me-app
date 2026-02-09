#!/usr/bin/env node
/**
 * 최종 정리 - 다크모드 ternary와 특수 케이스 처리
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const CLEANUP_REPLACEMENTS = [
  // Fix quoted Colors.light.x to actual tokens
  { from: /"Colors\.light\.backgroundSecondary"/g, to: 'Colors.light.backgroundSecondary' },
  { from: /"Colors\.light\.backgroundTertiary"/g, to: 'Colors.light.backgroundTertiary' },
  { from: /"Colors\.light\.buttonText"/g, to: 'Colors.light.buttonText' },
  { from: /'Colors\.light\.backgroundSecondary'/g, to: 'Colors.light.backgroundSecondary' },
  { from: /'Colors\.light\.backgroundTertiary'/g, to: 'Colors.light.backgroundTertiary' },
  { from: /'Colors\.light\.buttonText'/g, to: 'Colors.light.buttonText' },
  { from: /'BrandColors\.helperLight'/g, to: 'BrandColors.helperLight' },
  { from: /'BrandColors\.warningLight'/g, to: 'BrandColors.warningLight' },

  // Dark mode ternary expressions
  { from: /isDark \? '#1a365d' : 'BrandColors\.helperLight'/g, to: "isDark ? Colors.dark.backgroundSecondary : BrandColors.helperLight" },
  { from: /isDark \? '#1a365d' : BrandColors\.helperLight/g, to: "isDark ? Colors.dark.backgroundSecondary : BrandColors.helperLight" },
  { from: /isDark \? '#1c4532' : '#F0FFF4'/g, to: "isDark ? Colors.dark.backgroundSecondary : BrandColors.successLight" },
  { from: /isDark \? '#2d3748' : '#F7FAFC'/g, to: "isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundRoot" },
  { from: /isDark \? '#1a1a2e' : 'Colors\.light\.backgroundSecondary'/g, to: "isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundSecondary" },
  { from: /isDark \? '#1a1a2e' : Colors\.light\.backgroundSecondary/g, to: "isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundSecondary" },
  { from: /isDark \? '#7C2D12' : BrandColors\.warningLight/g, to: "isDark ? Colors.dark.backgroundSecondary : BrandColors.warningLight" },
  { from: /isDark \? '#2D3748' : 'Colors\.light\.buttonText'/g, to: "isDark ? Colors.dark.backgroundSecondary : Colors.light.buttonText" },
  { from: /isDark \? '#2D3748' : Colors\.light\.buttonText/g, to: "isDark ? Colors.dark.backgroundSecondary : Colors.light.buttonText" },
  { from: /isDark \? 'Colors\.light\.buttonText' : '#1A202C'/g, to: "isDark ? Colors.light.buttonText : Colors.light.text" },
  { from: /isDark \? Colors\.light\.buttonText : '#1A202C'/g, to: "isDark ? Colors.light.buttonText : Colors.light.text" },
  { from: /isDark \? "#1F1F1F" : "Colors\.light\.backgroundSecondary"/g, to: "isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundSecondary" },
  { from: /isDark \? "#333333" : "Colors\.light\.backgroundTertiary"/g, to: "isDark ? Colors.dark.backgroundTertiary : Colors.light.backgroundTertiary" },

  // Specific warning/error colors
  { from: /#D97706/g, to: 'BrandColors.warning' },
  { from: /#B45309/g, to: 'BrandColors.warning' },
  { from: /#2563EB/g, to: 'BrandColors.primaryLight' },
  { from: /#059669/g, to: 'BrandColors.success' },
  { from: /#1565C0/g, to: 'BrandColors.primaryLight' },
  { from: /#F0FFF4/g, to: 'BrandColors.successLight' },
  { from: /#F7FAFC/g, to: 'Colors.light.backgroundRoot' },
  { from: /#FEF2F2/g, to: 'BrandColors.errorLight' },
  { from: /#FECACA/g, to: 'BrandColors.errorLight' },
  { from: /#FEE500/g, to: 'BrandColors.warning' },
  { from: /#FBBF24/g, to: 'BrandColors.warning' },
  { from: /#FFB800/g, to: 'BrandColors.warning' },
  { from: /#ff4444/g, to: 'BrandColors.error' },
  { from: /#9F1239/g, to: 'BrandColors.error' },
  { from: /#3C1E1E/g, to: 'Colors.dark.backgroundSecondary' },
  { from: /#7B1FA2/g, to: 'BrandColors.requester' },

  // Remaining generic grays
  { from: /#F0F0F0/g, to: 'Colors.light.backgroundSecondary' },
  { from: /#e0e0e0/g, to: 'Colors.light.backgroundTertiary' },
  { from: /#000000/g, to: 'Colors.dark.text' },
];

function replaceColors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  let replacementCounts = {};

  CLEANUP_REPLACEMENTS.forEach(({ from, to }) => {
    const matches = content.match(from);
    if (matches && matches.length > 0) {
      content = content.replace(from, to);
      changed = true;
      replacementCounts[from.toString().substring(0, 60)] = matches.length;
    }
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${path.basename(filePath)}`);
    Object.entries(replacementCounts).forEach(([pattern, count]) => {
      console.log(`   ${count}개 교체: ${pattern}...`);
    });
    console.log('');
    return true;
  }

  return false;
}

const screenFiles = glob.sync('client/screens/**/*.tsx', {
  ignore: ['**/*.backup.tsx', '**/*.test.tsx']
});

console.log(`\n🧹 최종 정리 시작: ${screenFiles.length}개 파일\n`);

let totalChanged = 0;
let beforeTotal = 0;
let afterTotal = 0;

screenFiles.forEach(file => {
  const beforeContent = fs.readFileSync(file, 'utf8');
  const beforeCount = (beforeContent.match(/#[0-9A-Fa-f]{6}/gi) || []).length;
  beforeTotal += beforeCount;

  if (replaceColors(file)) {
    totalChanged++;
  }

  const afterContent = fs.readFileSync(file, 'utf8');
  const afterCount = (afterContent.match(/#[0-9A-Fa-f]{6}/gi) || []).length;
  afterTotal += afterCount;
});

console.log(`\n✅ 완료: ${totalChanged}/${screenFiles.length}개 파일 수정`);
console.log(`📊 전체 hex 색상: ${beforeTotal}개 → ${afterTotal}개 (${beforeTotal - afterTotal}개 교체)\n`);
