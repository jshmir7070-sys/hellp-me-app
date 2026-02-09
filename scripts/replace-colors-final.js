#!/usr/bin/env node
/**
 * 최종 색상 교체 - 모든 남은 hex 색상 처리
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const FINAL_REPLACEMENTS = [
  // #FFFFFF (83개) - 컨텍스트별 처리
  { from: /#FFFFFF/g, to: 'Colors.light.buttonText' },

  // #E0E0E0 (50개) - 테두리
  { from: /#E0E0E0/g, to: 'Colors.light.backgroundTertiary' },

  // Brand colors
  { from: /#EF4444/g, to: 'BrandColors.error' },
  { from: /#10B981/g, to: 'BrandColors.success' },
  { from: /#F59E0B/g, to: 'BrandColors.warning' },
  { from: /#3B82F6/g, to: 'BrandColors.primaryLight' },
  { from: /#dc3545/g, to: 'BrandColors.error' },

  // Light colors
  { from: /#FEE2E2/g, to: 'BrandColors.errorLight' },
  { from: /#FEF3C7/g, to: 'BrandColors.warningLight' },
  { from: /#DBEAFE/g, to: 'BrandColors.helperLight' },
  { from: /#D1FAE5/g, to: 'BrandColors.successLight' },
  { from: /#EBF8FF/g, to: 'BrandColors.helperLight' },

  // Background grays
  { from: /#F9FAFB/g, to: 'Colors.light.backgroundRoot' },
  { from: /#F5F5F5/g, to: 'Colors.light.backgroundSecondary' },
  { from: /#F3F4F6/g, to: 'Colors.light.backgroundSecondary' },
  { from: /#E5E7EB/g, to: 'Colors.light.backgroundSecondary' },
  { from: /#D1D5DB/g, to: 'Colors.light.backgroundSecondary' },

  // Text grays
  { from: /#4B5563/g, to: 'Colors.light.textSecondary' },
  { from: /#4A5568/g, to: 'Colors.light.textSecondary' },
  { from: /#6B7280/g, to: 'Colors.light.textSecondary' },
  { from: /#9CA3AF/g, to: 'Colors.light.textTertiary' },
  { from: /#374151/g, to: 'Colors.dark.textSecondary' },

  // Dark mode specific
  { from: /#1F2937/g, to: 'Colors.dark.backgroundSecondary' },
  { from: /#111827/g, to: 'Colors.dark.backgroundRoot' },
];

function addImports(content) {
  // Check if Colors is already imported
  if (content.includes('import { Colors }') || content.includes('Colors } from')) {
    return content;
  }

  // Find theme import and add Colors
  const themeImportMatch = content.match(/import \{([^}]+)\} from ["']@\/constants\/theme["']/);
  if (themeImportMatch) {
    const imports = themeImportMatch[1];
    if (!imports.includes('Colors')) {
      const newImports = imports.trim() + ', Colors';
      content = content.replace(
        /import \{([^}]+)\} from ["']@\/constants\/theme["']/,
        `import {${newImports}} from "@/constants/theme"`
      );
    }
  } else {
    // Add new import after other imports
    const lastImportMatch = content.match(/import .+ from .+;\n/g);
    if (lastImportMatch) {
      const lastImport = lastImportMatch[lastImportMatch.length - 1];
      content = content.replace(lastImport, lastImport + 'import { Colors } from "@/constants/theme";\n');
    }
  }

  return content;
}

function replaceColors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  let replacementCounts = {};

  FINAL_REPLACEMENTS.forEach(({ from, to }) => {
    const matches = content.match(from);
    if (matches && matches.length > 0) {
      content = content.replace(from, to);
      changed = true;
      replacementCounts[from.toString()] = matches.length;
    }
  });

  if (changed) {
    content = addImports(content);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${path.basename(filePath)}`);
    Object.entries(replacementCounts).forEach(([pattern, count]) => {
      const hexColor = pattern.match(/#[0-9A-Fa-f]{6}/)?.[0];
      console.log(`   ${hexColor} → ${count}개 교체`);
    });
    console.log('');
    return true;
  }

  return false;
}

// Find all target files
const screenFiles = glob.sync('client/screens/**/*.tsx', {
  ignore: ['**/*.backup.tsx', '**/*.test.tsx']
});

console.log(`\n🎨 최종 색상 교체 시작: ${screenFiles.length}개 파일\n`);

let totalChanged = 0;
let totalReplacements = 0;

screenFiles.forEach(file => {
  // Count hex colors before
  const beforeContent = fs.readFileSync(file, 'utf8');
  const beforeCount = (beforeContent.match(/#[0-9A-Fa-f]{6}/g) || []).length;

  if (replaceColors(file)) {
    totalChanged++;

    // Count hex colors after
    const afterContent = fs.readFileSync(file, 'utf8');
    const afterCount = (afterContent.match(/#[0-9A-Fa-f]{6}/g) || []).length;
    totalReplacements += (beforeCount - afterCount);
  }
});

console.log(`\n✅ 완료: ${totalChanged}/${screenFiles.length}개 파일 수정`);
console.log(`📊 총 ${totalReplacements}개 hex 색상 코드 교체됨\n`);
