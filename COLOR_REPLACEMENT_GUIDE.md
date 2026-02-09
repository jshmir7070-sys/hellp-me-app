# 색상 교체 자동화 가이드

## ✅ 완료된 파일
- ✅ HomeScreen.tsx (45/45)
- ✅ theme.ts
- ✅ Card.tsx

## 🔄 남은 파일 (VS Code 일괄 교체)

### 방법: VS Code Find & Replace (Regex)

1. **Ctrl+Shift+H** (Find in Files)
2. **파일 필터**: `client/screens/**/*.tsx`
3. **Use Regular Expression 활성화** (.*아이콘)

### 교체 순서 (순서대로 실행)

#### 1단계: 인라인 스타일 (theme 사용)

| 찾기 (Regex) | 교체 |
|-------------|------|
| `\{ color: '#FFFFFF' \}` | `{ color: theme.buttonText }` |
| `\{ color: '#1A1A1A' \}` | `{ color: theme.text }` |
| `\{ color: '#666666' \}` | `{ color: theme.textSecondary }` |
| `\{ backgroundColor: '#FFFFFF' \}` | `{ backgroundColor: theme.backgroundDefault }` |
| `\{ backgroundColor: '#F5F5F5' \}` | `{ backgroundColor: theme.backgroundSecondary }` |
| `\{ borderColor: '#CCCCCC' \}` | `{ borderColor: theme.border }` |

#### 2단계: BrandColors 상수 교체

| 찾기 | 교체 |
|------|------|
| `'#3B82F6'` | `BrandColors.primaryLight` |
| `'#EF4444'` | `BrandColors.error` |
| `'#DC2626'` | `BrandColors.error` |
| `'#10B981'` | `BrandColors.success` |
| `'#22C55E'` | `BrandColors.success` |
| `'#F59E0B'` | `BrandColors.warning` |
| `'#DBEAFE'` | `BrandColors.helperLight` |
| `'#D1FAE5'` | `BrandColors.successLight` |
| `'#FEF3C7'` | `BrandColors.warningLight` |
| `'#FEE2E2'` | `BrandColors.errorLight` |

#### 3단계: Icon color 속성

| 찾기 (Regex) | 교체 |
|-------------|------|
| `color="#FFFFFF"` | `color={theme.buttonText}` |
| `color="#EF4444"` | `color={BrandColors.error}` |
| `color="#10B981"` | `color={BrandColors.success}` |
| `color="#F59E0B"` | `color={BrandColors.warning}` |

#### 4단계: StyleSheet 색상 (Colors.light 사용)

| 찾기 (Regex) | 교체 |
|-------------|------|
| `color: '#FFFFFF',` | `color: Colors.light.buttonText,` |
| `color: '#1A1A1A',` | `color: Colors.light.text,` |
| `color: '#666666',` | `color: Colors.light.textSecondary,` |
| `color: '#888',` | `color: Colors.light.textTertiary,` |
| `backgroundColor: '#FFFFFF',` | `backgroundColor: Colors.light.backgroundDefault,` |
| `backgroundColor: '#F5F5F5',` | `backgroundColor: Colors.light.backgroundSecondary,` |
| `backgroundColor: '#E0E0E0',` | `backgroundColor: Colors.light.backgroundTertiary,` |
| `borderColor: '#CCCCCC',` | `borderColor: Colors.light.border,` |
| `borderColor: '#E5E5E5',` | `borderColor: Colors.light.border,` |

#### 5단계: Colors import 추가

각 파일 상단에 Colors가 없으면 추가:

**변경 전**:
```typescript
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
```

**변경 후**:
```typescript
import { Spacing, BorderRadius, Typography, BrandColors, Colors } from "@/constants/theme";
```

---

## 🎯 대상 파일 리스트 (우선순위순)

### 최우선 (UI 화면)
1. CreateJobScreen.tsx (47건)
2. CreateContractScreen.tsx (38건)
3. SignupScreen.tsx (16건)
4. LoginScreen.tsx (이미 일부 완료)
5. ProfileScreen.tsx (일부 필요)

### 중요 (헬퍼/요청자)
6. HelperOnboardingScreen.tsx (18건)
7. ContractScreen.tsx (6건)
8. PaymentScreen.tsx
9. SettlementScreen.tsx (6건)
10. ClosingReportScreen.tsx (6건)

### 관리자 화면
11. AdminDeductionListScreen.tsx
12. AdminDisputeListScreen.tsx
13. AdminDisputeDetailScreen.tsx
14. AdminIncidentListScreen.tsx
15. AdminOrderDetailScreen.tsx
16. AdminRefundListScreen.tsx

### 나머지
17. BusinessRegistrationScreen.tsx (19건)
18. SettingsScreen.tsx (5건)
19. EditProfileScreen.tsx (9건)
20. JobDetailScreen.tsx (9건)
21. QRScannerScreen.tsx (7건)

---

## 🔍 검증 방법

교체 후 다음 명령어로 남은 하드코딩 확인:

```bash
# 각 파일별 남은 색상 확인
grep -r "#[0-9A-Fa-f]\{6\}\|#[0-9A-Fa-f]\{3\}" client/screens/ --include="*.tsx" | grep -v "shadowColor\|BrandColors\|Colors" | wc -l

# 특정 파일 확인
grep "#[0-9A-Fa-f]\{6\}\|#[0-9A-Fa-f]\{3\}" client/screens/CreateJobScreen.tsx | grep -v "shadowColor\|BrandColors\|Colors"
```

---

## ⚠️ 주의사항

### 교체하지 말아야 할 것들
- `shadowColor: '#000'` → 표준 그림자 색상 (유지)
- `shadowColor: '#000',` → 유지
- 이미 `BrandColors.xxx` 형태 → 유지
- 이미 `Colors.light.xxx` 형태 → 유지
- 이미 `theme.xxx` 형태 → 유지

### 다크모드 대응
- **인라인 스타일**: `theme.xxx` 사용 (자동 다크모드)
- **StyleSheet**: `Colors.light.xxx` 사용 (정적, 라이트 전용)
  - 다크모드가 중요한 경우 인라인 스타일로 변경 필요

---

## 📊 예상 소요 시간

| 방법 | 시간 | 정확도 |
|------|------|--------|
| VS Code 일괄 교체 | 30분 | 95% |
| 파일별 수동 교체 | 4시간 | 100% |
| 스크립트 자동화 | 5분 | 90% (검수 필요) |

**권장**: VS Code 일괄 교체 → 검증 → 필요시 수동 수정

---

**작성**: Claude Sonnet 4.5
**날짜**: 2026-02-09
**완료**: HomeScreen.tsx, theme.ts, Card.tsx
**남은 작업**: 14개 주요 화면 + 나머지
