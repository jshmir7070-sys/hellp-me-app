#!/usr/bin/env node
/**
 * 고급 색상 교체 - 인라인 ternary 및 object literal의 hex 색상 처리
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const ADVANCED_REPLACEMENTS = [
  // 인라인 borderColor ternary
  { from: /borderColor: isDark \? Colors\.dark\.backgroundSecondary : '#E0E0E0'/g, to: 'borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary' },
  { from: /borderColor: isDark \? Colors\.dark\.backgroundSecondary : '#D1D5DB'/g, to: 'borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundSecondary' },
  { from: /borderColor: isDark \? Colors\.dark\.backgroundSecondary : '#CCCCCC'/g, to: 'borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.border' },

  // 인라인 backgroundColor ternary
  { from: /backgroundColor: isDark \? '#4C0519' : BrandColors\.errorLight/g, to: 'backgroundColor: isDark ? Colors.dark.backgroundSecondary : BrandColors.errorLight' },
  { from: /backgroundColor: isDark \? Colors\.dark\.backgroundSecondary : '#F3F4F6'/g, to: 'backgroundColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundSecondary' },
  { from: /backgroundColor: isDark \? Colors\.dark\.backgroundSecondary : '#F5F5F5'/g, to: 'backgroundColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundSecondary' },
  { from: /backgroundColor: isDark \? Colors\.dark\.backgroundSecondary : '#E5E7EB'/g, to: 'backgroundColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundSecondary' },

  // 인라인 color ternary
  { from: /color: isDark \? '#FCA5A5' : '#991B1B'/g, to: 'color: isDark ? Colors.dark.textSecondary : BrandColors.error' },
  { from: /color: activeTab === tab \? '#FFFFFF' : theme\.text/g, to: 'color: activeTab === tab ? Colors.light.buttonText : theme.text' },
  { from: /{ color: '#92400E'/g, to: '{ color: BrandColors.warning' },
  { from: /{ color: '#1E40AF'/g, to: '{ color: BrandColors.primaryLight' },
  { from: /{ color: '#6B7280'/g, to: '{ color: Colors.light.textSecondary' },
  { from: /{ color: '#991B1B'/g, to: '{ color: BrandColors.error' },

  // trackColor 및 thumbColor
  { from: /trackColor: \{ false: '#D1D5DB', true: BrandColors\.(.*?) \}/g, to: 'trackColor: { false: Colors.light.backgroundSecondary, true: BrandColors.$1 }' },
  { from: /thumbColor=\{checked \? '#FFFFFF' : '#F3F4F6'\}/g, to: 'thumbColor={checked ? Colors.light.buttonText : Colors.light.backgroundSecondary}' },

  // borderColor 단독
  { from: /borderColor: '#E0E0E0'/g, to: 'borderColor: Colors.light.backgroundTertiary' },
  { from: /borderColor: '#D1D5DB'/g, to: 'borderColor: Colors.light.backgroundSecondary' },
  { from: /borderColor: '#CCCCCC'/g, to: 'borderColor: Colors.light.border' },
  { from: /borderColor: '#9F1239'/g, to: 'borderColor: BrandColors.error' },
  { from: /borderColor: '#FECACA'/g, to: 'borderColor: BrandColors.errorLight' },

  // StyleSheet 내부 hex 색상
  { from: /backgroundColor: '#F9FAFB',/g, to: 'backgroundColor: Colors.light.backgroundRoot,' },
  { from: /backgroundColor: '#F3F4F6',/g, to: 'backgroundColor: Colors.light.backgroundSecondary,' },
  { from: /backgroundColor: '#E5E7EB',/g, to: 'backgroundColor: Colors.light.backgroundSecondary,' },
  { from: /backgroundColor: '#D1D5DB',/g, to: 'backgroundColor: Colors.light.backgroundSecondary,' },
  { from: /color: '#92400E',/g, to: 'color: BrandColors.warning,' },
  { from: /color: '#1E40AF',/g, to: 'color: BrandColors.primaryLight,' },
  { from: /color: '#6B7280',/g, to: 'color: Colors.light.textSecondary,' },
  { from: /color: '#991B1B',/g, to: 'color: BrandColors.error,' },
  { from: /color: '#374151',/g, to: 'color: Colors.dark.textSecondary,' },
];

function replaceColors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  ADVANCED_REPLACEMENTS.forEach(({ from, to }) => {
    if (content.match(from)) {
      const beforeCount = (content.match(from) || []).length;
      content = content.replace(from, to);
      changed = true;
      console.log(`  - ${beforeCount}개 패턴 교체: ${from.toString().substring(0, 50)}...`);
    }
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${path.basename(filePath)}\n`);
    return true;
  }

  return false;
}

// 대상 파일 찾기
const screenFiles = glob.sync('client/screens/**/*.tsx', {
  ignore: ['**/*.backup.tsx', '**/*.test.tsx']
});

console.log(`\n🎨 고급 색상 교체 시작: ${screenFiles.length}개 파일\n`);

let totalChanged = 0;
screenFiles.forEach(file => {
  if (replaceColors(file)) {
    totalChanged++;
  }
});

console.log(`\n✅ 완료: ${totalChanged}/${screenFiles.length}개 파일 수정됨\n`);
