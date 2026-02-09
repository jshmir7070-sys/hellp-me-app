#!/usr/bin/env node
/**
 * 전체 화면 파일의 하드코딩된 색상을 테마 토큰으로 일괄 교체
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const REPLACEMENTS = [
  // 인라인 스타일 교체
  { from: /{ color: '#1A1A1A' }/g, to: '{ color: theme.text }' },
  { from: /{ color: '#666666' }/g, to: '{ color: theme.textSecondary }' },
  { from: /{ color: '#999999'(.*?)}/g, to: '{ color: theme.textTertiary$1}' },
  { from: /{ color: '#888'(.*?)}/g, to: '{ color: theme.textTertiary$1}' },
  { from: /{ color: '#FFFFFF' }/g, to: '{ color: theme.buttonText }' },
  { from: /{ color: '#fff' }/g, to: '{ color: theme.buttonText }' },
  { from: /{ backgroundColor: '#FFFFFF' }/g, to: '{ backgroundColor: theme.backgroundDefault }' },
  { from: /{ backgroundColor: '#F5F5F5' }/g, to: '{ backgroundColor: theme.backgroundSecondary }' },
  { from: /{ backgroundColor: '#E0E0E0' }/g, to: '{ backgroundColor: theme.backgroundTertiary }' },
  { from: /{ borderColor: '#CCCCCC' }/g, to: '{ borderColor: theme.border }' },
  { from: /{ borderColor: '#E5E5E5' }/g, to: '{ borderColor: theme.border }' },

  // BrandColors 교체
  { from: /'#3B82F6'/g, to: 'BrandColors.primaryLight' },
  { from: /'#EF4444'/g, to: 'BrandColors.error' },
  { from: /'#10B981'/g, to: 'BrandColors.success' },
  { from: /'#F59E0B'/g, to: 'BrandColors.warning' },
  { from: /'#DC2626'/g, to: 'BrandColors.error' },
  { from: /'#22C55E'/g, to: 'BrandColors.success' },
  { from: /'#DBEAFE'/g, to: 'BrandColors.helperLight' },
  { from: /'#D1FAE5'/g, to: 'BrandColors.successLight' },
  { from: /'#FEF3C7'/g, to: 'BrandColors.warningLight' },
  { from: /'#FEE2E2'/g, to: 'BrandColors.errorLight' },

  // StyleSheet 교체
  { from: /color: '#1A1A1A',/g, to: 'color: Colors.light.text,' },
  { from: /color: '#666666',/g, to: 'color: Colors.light.textSecondary,' },
  { from: /color: '#888',/g, to: 'color: Colors.light.textTertiary,' },
  { from: /color: '#FFFFFF',/g, to: 'color: Colors.light.buttonText,' },
  { from: /color: '#fff',/g, to: 'color: Colors.light.buttonText,' },
  { from: /backgroundColor: '#FFFFFF',/g, to: 'backgroundColor: Colors.light.backgroundDefault,' },
  { from: /backgroundColor: '#F5F5F5',/g, to: 'backgroundColor: Colors.light.backgroundSecondary,' },
  { from: /backgroundColor: '#E0E0E0',/g, to: 'backgroundColor: Colors.light.backgroundTertiary,' },
  { from: /borderColor: '#CCCCCC',/g, to: 'borderColor: Colors.light.border,' },
  { from: /borderColor: '#E5E5E5',/g, to: 'borderColor: Colors.light.border,' },
  { from: /borderTopColor: '#EEEEEE',/g, to: 'borderTopColor: Colors.light.divider,' },
];

function addImports(content, filePath) {
  // 이미 Colors import가 있는지 확인
  if (content.includes('import { Colors }') || content.includes('Colors } from')) {
    return content;
  }

  // theme import 찾기
  const themeImportMatch = content.match(/import \{([^}]+)\} from ['"]@\/constants\/theme['"]/);
  if (themeImportMatch) {
    const imports = themeImportMatch[1];
    if (!imports.includes('Colors')) {
      const newImports = imports.trim() + ', Colors';
      content = content.replace(
        /import \{([^}]+)\} from ['"]@\/constants\/theme['"]/,
        `import {${newImports}} from "@/constants/theme"`
      );
    }
  }

  return content;
}

function replaceColors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  REPLACEMENTS.forEach(({ from, to }) => {
    if (content.match(from)) {
      content = content.replace(from, to);
      changed = true;
    }
  });

  if (changed) {
    // Colors import 추가
    content = addImports(content, filePath);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${path.basename(filePath)}`);
    return true;
  }

  return false;
}

// 대상 파일 찾기
const screenFiles = glob.sync('client/screens/**/*.tsx', {
  ignore: ['**/*.backup.tsx', '**/*.test.tsx']
});

console.log(`\n🎨 색상 교체 시작: ${screenFiles.length}개 파일\n`);

let totalChanged = 0;
screenFiles.forEach(file => {
  if (replaceColors(file)) {
    totalChanged++;
  }
});

console.log(`\n✅ 완료: ${totalChanged}/${screenFiles.length}개 파일 수정됨\n`);
