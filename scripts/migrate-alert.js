/**
 * Script to migrate Alert.alert → useSystemNotification (toast/sysAlert)
 * Run: node scripts/migrate-alert.js
 */
const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, '..', 'client');

// Find all .tsx files with Alert.alert
function findFiles(dir, pattern) {
  const results = [];
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
      results.push(...findFiles(fullPath, pattern));
    } else if (file.isFile() && /\.(tsx?|jsx?)$/.test(file.name)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (pattern.test(content)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

const SKIP_FILES = [
  'INTEGRATION.md',
  'SystemNotificationProvider.tsx',
  'Step1BasicInfo.ENHANCED.example.tsx',
];

const files = findFiles(clientDir, /Alert\.alert/).filter(f => {
  const basename = path.basename(f);
  return !SKIP_FILES.includes(basename);
});

console.log(`Found ${files.length} files with Alert.alert`);

let totalMigrated = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  const basename = path.basename(file);
  const originalContent = content;

  // Check if already has useSystemNotification import
  const hasImport = content.includes('useSystemNotification');

  if (!hasImport) {
    // Step 1: Remove Alert from react-native import
    content = content.replace(
      /import\s*\{([^}]*)\bAlert\b([^}]*)\}\s*from\s*['"]react-native['"]/,
      (match, before, after) => {
        const cleaned = (before + after)
          .replace(/,\s*,/g, ',')
          .replace(/\{\s*,/, '{')
          .replace(/,\s*\}/, '}')
          .replace(/^\s*,\s*/, '')
          .replace(/\s*,\s*$/, '');
        return `import {${cleaned}} from 'react-native'`;
      }
    );

    // Also handle multiline imports
    content = content.replace(/\n\s*Alert,?\n/g, '\n');
    // Handle "  Alert," on its own line
    if (content.includes('  Alert,')) {
      content = content.replace(/\s+Alert,\n/g, '\n');
    }
    if (content.includes('  Alert\n')) {
      content = content.replace(/\s+Alert\n/g, '\n');
    }

    // Step 2: Add useSystemNotification import after useTheme import
    if (content.includes("from '@/hooks/useTheme'") || content.includes('from "@/hooks/useTheme"')) {
      const quote = content.includes("from '@/hooks/useTheme'") ? "'" : '"';
      content = content.replace(
        new RegExp(`import \\{ useTheme \\} from ${quote === "'" ? "'" : '"'}@/hooks/useTheme${quote === "'" ? "'" : '"'};`),
        (match) => `${match}\nimport { useSystemNotification } from ${quote}@/components/notifications/SystemNotificationProvider${quote};`
      );
    } else {
      // Fallback: add after last import
      const lastImportIdx = content.lastIndexOf('\nimport ');
      if (lastImportIdx !== -1) {
        const lineEnd = content.indexOf('\n', lastImportIdx + 1);
        const importLine = content.substring(lastImportIdx, lineEnd);
        const semi = content.indexOf(';', lastImportIdx);
        if (semi !== -1) {
          const afterSemi = semi + 1;
          content = content.substring(0, afterSemi) +
            "\nimport { useSystemNotification } from '@/components/notifications/SystemNotificationProvider';" +
            content.substring(afterSemi);
        }
      }
    }

    // Step 3: Add hook declaration after useTheme()
    const themeMatch = content.match(/const \{ theme[^}]*\} = useTheme\(\);/);
    if (themeMatch) {
      const idx = content.indexOf(themeMatch[0]) + themeMatch[0].length;
      content = content.substring(0, idx) +
        '\n  const { toast, sysAlert } = useSystemNotification();' +
        content.substring(idx);
    }
  }

  // Step 4: Replace Alert.alert patterns

  // Pattern 1: Simple Alert.alert('Title', 'message'); - error type
  content = content.replace(
    /Alert\.alert\(['"]오류['"],\s*(['"][^'"]*['"](?:\s*\|\|\s*['"][^'"]*['"])?)\);/g,
    'toast.error($1, \'오류\');'
  );

  // Pattern 2: Simple Alert.alert with error variable
  content = content.replace(
    /Alert\.alert\(['"]오류['"],\s*([\w.?]+\s*\|\|\s*['"][^'"]*['"])\);/g,
    'toast.error($1, \'오류\');'
  );
  content = content.replace(
    /Alert\.alert\(['"]오류['"],\s*([\w.?]+)\);/g,
    'toast.error($1, \'오류\');'
  );

  // Pattern 3: Warning/info alerts
  content = content.replace(
    /Alert\.alert\(['"]알림['"],\s*(['"][^'"]*['"])\);/g,
    'toast.warning($1, \'알림\');'
  );

  // Pattern 4: Success messages
  content = content.replace(
    /Alert\.alert\(['"]완료['"],\s*(['"][^'"]*['"])\);/g,
    'toast.success($1, \'완료\');'
  );

  // Pattern 5: Various titled alerts without buttons
  const simpleAlertTitles = [
    '권한 필요', '지원 실패', '취소 실패', '전송 완료', '복사 완료',
    '인증번호 발송', '인증 완료', '인증 실패', '입력 오류', '저장 완료',
    '배정 완료', '등록 완료', '삭제 완료', '수정 완료', '제출 완료',
    '알림', '오류', '완료', '실패', '성공',
  ];

  for (const title of simpleAlertTitles) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Simple string message
    const re = new RegExp(
      `Alert\\.alert\\(['"]${escaped}['"],\\s*(['"][^'"]*['"])\\);`,
      'g'
    );
    const type = title.includes('오류') || title.includes('실패') ? 'error' :
                 title.includes('완료') || title.includes('성공') ? 'success' :
                 title.includes('알림') || title.includes('권한') ? 'warning' : 'info';
    content = content.replace(re, `toast.${type}($1, '${title}');`);

    // Variable message
    const reVar = new RegExp(
      `Alert\\.alert\\(['"]${escaped}['"],\\s*([\\w.?]+(?:\\s*\\|\\|\\s*['"][^'"]*['"])?)\\);`,
      'g'
    );
    content = content.replace(reVar, `toast.${type}($1, '${title}');`);
  }

  // Pattern 6: Alert.alert with buttons (use sysAlert) - match multiline
  // This handles: Alert.alert("Title", "message", [...buttons...]);
  content = content.replace(
    /Alert\.alert\(/g,
    'sysAlert('
  );

  // Step 5: Remove Platform.OS web/native conditional alert blocks
  // Pattern: if (Platform.OS === 'web') { alert(msg); } else { sysAlert(...); }
  // Replace with just the sysAlert part
  content = content.replace(
    /if\s*\(Platform\.OS\s*===\s*['"]web['"]\)\s*\{\s*alert\([^)]*\);\s*\}\s*else\s*\{\s*((?:toast|sysAlert)\([^}]+)\}\s*/g,
    '$1'
  );

  // Pattern: if (Platform.OS !== 'web') { sysAlert(...); }
  content = content.replace(
    /if\s*\(Platform\.OS\s*!==\s*['"]web['"]\)\s*\{\s*((?:toast|sysAlert)\([^}]+)\}\s*/g,
    '$1'
  );

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf-8');
    const remaining = (content.match(/Alert\.alert/g) || []).length;
    const migrated = (originalContent.match(/Alert\.alert/g) || []).length - remaining;
    totalMigrated += migrated;
    console.log(`  ${basename}: migrated ${migrated} calls (${remaining} remaining)`);
    if (remaining > 0) {
      // Show remaining lines for manual review
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('Alert.alert')) {
          console.log(`    Line ${i+1}: ${line.trim()}`);
        }
      });
    }
  } else {
    console.log(`  ${basename}: no changes needed`);
  }
}

console.log(`\nTotal migrated: ${totalMigrated}`);
