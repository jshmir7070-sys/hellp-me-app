/**
 * ═══════════════════════════════════════════════════════════
 * contracts.ts 사용 가이드
 * ═══════════════════════════════════════════════════════════
 *
 * 이 파일은 사용 예시이며, 실제 컴포넌트에 맞게 수정하여 사용하세요.
 */

// ──────────────────────────────────────────────────────────
// [예시 1] 헬퍼 가입 시 계약 화면 (1회)
// ──────────────────────────────────────────────────────────
/*
import {
  HELPER_CONTRACT_TERMS,
  HELPER_CONTRACT_CHECKBOX_KEYS,
  createHelperContractState,
  isAllRequiredAgreed,
} from '@/constants/contracts';

// 상태 초기화
const [agreements, setAgreements] = useState(createHelperContractState());

// 전체 동의 토글
const handleAllAgree = () => {
  const newVal = !agreements.all;
  const newState: Record<string, boolean> = { all: newVal };
  [...HELPER_CONTRACT_CHECKBOX_KEYS.required, ...HELPER_CONTRACT_CHECKBOX_KEYS.optional]
    .forEach(key => { newState[key] = newVal; });
  setAgreements(newState);
};

// 개별 항목 토글
const handleToggle = (key: string) => {
  setAgreements(prev => ({ ...prev, [key]: !prev[key] }));
};

// 필수 항목 전체 동의 여부
const canSubmit = isAllRequiredAgreed(agreements, HELPER_CONTRACT_CHECKBOX_KEYS.required);

// 약관 내용 모달
const [modalTerm, setModalTerm] = useState<{ title: string; content: string } | null>(null);

// 렌더링 예시
<ScrollView>
  {/* 계약 개요 */}
  <ThemedText>{HELPER_CONTRACT_TERMS.contractOverview.content}</ThemedText>

  {/* 필수 항목 */}
  <ThemedText style={{ fontWeight: 'bold' }}>[ 필수 동의 ]</ThemedText>
  {HELPER_CONTRACT_CHECKBOX_KEYS.required.map(key => {
    const term = HELPER_CONTRACT_TERMS[key];
    return (
      <Pressable key={key} onPress={() => handleToggle(key)} style={{ flexDirection: 'row' }}>
        <View style={[styles.checkbox, agreements[key] && styles.checked]}>
          {agreements[key] && <Icon name="checkmark" />}
        </View>
        <ThemedText>{term.title}</ThemedText>
        <Pressable onPress={() => setModalTerm(term)}>
          <ThemedText style={{ color: '#2563EB' }}>[보기]</ThemedText>
        </Pressable>
      </Pressable>
    );
  })}

  {/* 선택 항목 */}
  <ThemedText style={{ fontWeight: 'bold' }}>[ 선택 동의 ]</ThemedText>
  {HELPER_CONTRACT_CHECKBOX_KEYS.optional.map(key => {
    const term = HELPER_CONTRACT_TERMS[key];
    return (
      <Pressable key={key} onPress={() => handleToggle(key)} style={{ flexDirection: 'row' }}>
        <View style={[styles.checkbox, agreements[key] && styles.checked]}>
          {agreements[key] && <Icon name="checkmark" />}
        </View>
        <ThemedText>{term.title}</ThemedText>
        <Pressable onPress={() => setModalTerm(term)}>
          <ThemedText style={{ color: '#666' }}>[보기]</ThemedText>
        </Pressable>
      </Pressable>
    );
  })}

  {/* 제출 버튼 */}
  <Button disabled={!canSubmit} onPress={handleSubmit}>계약 동의 완료</Button>
</ScrollView>
*/


// ──────────────────────────────────────────────────────────
// [예시 2] 요청자 오더 등록 시 계약 화면 (매 오더)
// ──────────────────────────────────────────────────────────
/*
import {
  REQUESTER_ORDER_CONTRACT_TERMS,
  REQUESTER_ORDER_CHECKBOX_KEYS,
  createRequesterOrderContractState,
  isAllRequiredAgreed,
} from '@/constants/contracts';

// 상태 초기화 (오더 등록 화면 진입시마다)
const [orderAgreements, setOrderAgreements] = useState(createRequesterOrderContractState());

// 필수 항목 전체 동의 시에만 "계약금 결제" 버튼 활성화
const canPayDeposit = isAllRequiredAgreed(
  orderAgreements,
  REQUESTER_ORDER_CHECKBOX_KEYS.required
);

// 서버 전송 시 동의 기록 포함
const submitOrder = async () => {
  const response = await fetch('/api/requester/orders', {
    method: 'POST',
    body: JSON.stringify({
      ...orderData,
      contractAgreements: {
        ...orderAgreements,
        agreedAt: new Date().toISOString(),
      },
    }),
  });
};
*/


// ──────────────────────────────────────────────────────────
// [예시 3] termsVersions 테이블에 저장 (서버 시드)
// ──────────────────────────────────────────────────────────
/*
// 관리자 페이지 또는 시드 스크립트에서 실행

// 헬퍼 계약서 (가입 시 1회)
await db.insert(termsVersions).values({
  termsType: 'helper_contract',
  version: '1.0.0',
  title: '화물운송위탁계약서 (헬퍼 ↔ 본사)',
  content: JSON.stringify(HELPER_CONTRACT_TERMS), // 전체 JSON 저장
  summary: '최초 버전',
  isActive: true,
  effectiveDate: new Date('2026-03-01'),
});

// 요청자 오더 계약서 (오더 등록시마다)
await db.insert(termsVersions).values({
  termsType: 'requester_order',
  version: '1.0.0',
  title: '화물운송위탁계약서 (요청자 ↔ 본사)',
  content: JSON.stringify(REQUESTER_ORDER_CONTRACT_TERMS), // 전체 JSON 저장
  summary: '최초 버전',
  isActive: true,
  effectiveDate: new Date('2026-03-01'),
});
*/


// ──────────────────────────────────────────────────────────
// [예시 4] 동의 기록 서버 저장
// ──────────────────────────────────────────────────────────
/*
// signupConsents 테이블 활용 (헬퍼 가입 시)
await db.insert(signupConsents).values({
  userId: user.id,
  role: 'helper',
  termsAgreed: agreements.contractPurpose,
  privacyAgreed: agreements.privacyConsent,
  locationAgreed: true, // 위치 동의는 가입 시 별도
  paymentAgreed: agreements.paymentSettlement,
  liabilityAgreed: agreements.helperObligations,
  electronicAgreed: agreements.electronicContract,
  industrialAccidentInsuranceAgreed: agreements.insuranceConfirm,
  cargoInsuranceAgreed: agreements.insuranceConfirm,
  independentContractorAgreed: agreements.independentContractor,
  marketingAgreed: agreements.marketingConsent ?? false,
  ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
  userAgent: req.headers['user-agent'],
  consentLog: JSON.stringify({
    agreedAt: new Date().toISOString(),
    contractVersion: '1.0.0',
    items: Object.entries(agreements).map(([key, value]) => ({
      key,
      agreed: value,
      timestamp: new Date().toISOString(),
    })),
  }),
});

// 오더별 동의 기록 (요청자 오더 등록 시)
// orders 테이블의 contractConfirmed + 별도 consent 로그
await storage.updateOrder(orderId, {
  contractConfirmed: true,
  contractConfirmedAt: new Date(),
  // consent 로그는 별도 필드 또는 테이블에 저장
});
*/

export {};
