#!/usr/bin/env node
/**
 * JSX 구문 오류 수정 - color= 뒤에 중괄호 추가
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const FIXES = [
  // color=Colors.x → color={Colors.x}
  { from: /color=Colors\.light\.buttonText/g, to: 'color={Colors.light.buttonText}' },
  { from: /color=Colors\.light\.text/g, to: 'color={Colors.light.text}' },
  { from: /color=Colors\.light\.textSecondary/g, to: 'color={Colors.light.textSecondary}' },
  { from: /color=Colors\.light\.textTertiary/g, to: 'color={Colors.light.textTertiary}' },
  { from: /color=Colors\.dark\.buttonText/g, to: 'color={Colors.dark.buttonText}' },
  { from: /color=Colors\.dark\.text/g, to: 'color={Colors.dark.text}' },
  { from: /color=Colors\.dark\.textSecondary/g, to: 'color={Colors.dark.textSecondary}' },

  // color=BrandColors.x → color={BrandColors.x}
  { from: /color=BrandColors\.primaryLight/g, to: 'color={BrandColors.primaryLight}' },
  { from: /color=BrandColors\.helper/g, to: 'color={BrandColors.helper}' },
  { from: /color=BrandColors\.requester/g, to: 'color={BrandColors.requester}' },
  { from: /color=BrandColors\.success/g, to: 'color={BrandColors.success}' },
  { from: /color=BrandColors\.warning/g, to: 'color={BrandColors.warning}' },
  { from: /color=BrandColors\.error/g, to: 'color={BrandColors.error}' },

  // backgroundColor=Colors.x → backgroundColor={Colors.x}
  { from: /backgroundColor=Colors\.light\.buttonText/g, to: 'backgroundColor={Colors.light.buttonText}' },
  { from: /backgroundColor=Colors\.light\.backgroundDefault/g, to: 'backgroundColor={Colors.light.backgroundDefault}' },
  { from: /backgroundColor=Colors\.light\.backgroundSecondary/g, to: 'backgroundColor={Colors.light.backgroundSecondary}' },
  { from: /backgroundColor=Colors\.dark\.backgroundSecondary/g, to: 'backgroundColor={Colors.dark.backgroundSecondary}' },

  // backgroundColor=BrandColors.x → backgroundColor={BrandColors.x}
  { from: /backgroundColor=BrandColors\.primaryLight/g, to: 'backgroundColor={BrandColors.primaryLight}' },
  { from: /backgroundColor=BrandColors\.helper/g, to: 'backgroundColor={BrandColors.helper}' },
  { from: /backgroundColor=BrandColors\.requester/g, to: 'backgroundColor={BrandColors.requester}' },
  { from: /backgroundColor=BrandColors\.success/g, to: 'backgroundColor={BrandColors.success}' },
  { from: /backgroundColor=BrandColors\.warning/g, to: 'backgroundColor={BrandColors.warning}' },
  { from: /backgroundColor=BrandColors\.error/g, to: 'backgroundColor={BrandColors.error}' },
];

function fixSyntax(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  let fixCount = 0;

  FIXES.forEach(({ from, to }) => {
    const matches = content.match(from);
    if (matches && matches.length > 0) {
      content = content.replace(from, to);
      changed = true;
      fixCount += matches.length;
    }
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${path.basename(filePath)} - ${fixCount}개 수정`);
    return true;
  }

  return false;
}

// Find all screen files
const screenFiles = glob.sync('client/screens/**/*.tsx', {
  ignore: ['**/*.backup.tsx', '**/*.test.tsx']
});

console.log(`\n🔧 JSX 구문 오류 수정 시작: ${screenFiles.length}개 파일\n`);

let totalFixed = 0;
screenFiles.forEach(file => {
  if (fixSyntax(file)) {
    totalFixed++;
  }
});

console.log(`\n✅ 완료: ${totalFixed}개 파일 수정됨\n`);
