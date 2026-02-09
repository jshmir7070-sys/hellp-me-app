import React, { useState } from "react";
import { View, Pressable, StyleSheet, ScrollView, Linking, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";

type SupportScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSection {
  id: string;
  title: string;
  icon: string;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    id: 'account',
    title: '계정/회원',
    icon: 'account-outline',
    items: [
      {
        question: '비밀번호를 잊어버렸어요',
        answer: '비밀번호 재설정 방법:\n\n1. 로그인 화면에서 "비밀번호 찾기" 터치\n2. 가입 시 사용한 이메일 입력\n3. 이메일로 재설정 링크 발송\n4. 링크 클릭 후 새 비밀번호 설정\n\n[이메일이 안 오는 경우]\n• 스팸함 확인\n• 이메일 주소 정확히 입력했는지 확인\n• 5분 후 재시도\n• 계속 안 되면 고객센터 문의',
      },
      {
        question: '회원탈퇴는 어떻게 하나요?',
        answer: '회원탈퇴 절차:\n\n[탈퇴 조건]\n• 진행중인 오더가 없어야 함\n• 모든 정산이 완료되어야 함\n• 미수금/미지급금이 없어야 함\n\n[탈퇴 방법]\n나의정보 > 앱 설정 > 회원탈퇴\n1. 탈퇴 사유 선택\n2. 비밀번호 확인\n3. 탈퇴 완료\n\n[탈퇴 후]\n• 모든 데이터 삭제 (복구 불가)\n• 동일 이메일로 재가입 가능\n• 재가입 시 새로운 계정으로 시작',
      },
      {
        question: '전화번호를 변경하고 싶어요',
        answer: '전화번호 변경 방법:\n\n나의정보 > 프로필 수정\n1. 전화번호 항목 터치\n2. 새 전화번호 입력\n3. SMS 인증 진행\n4. 변경 완료\n\n[주의사항]\n• 본인 명의 휴대폰만 가능\n• 인증 후 즉시 변경됨\n• 변경 이력은 관리자가 확인 가능',
      },
      {
        question: '헬퍼/요청자 계정 전환이 가능한가요?',
        answer: '계정 전환 안내:\n\n헬퍼와 요청자는 별도 계정으로 운영됩니다.\n\n[전환 방법]\n• 직접 전환은 불가능\n• 다른 유형으로 활동하려면 새 계정 생성\n• 다른 이메일로 가입 필요\n\n[참고]\n• 하나의 휴대폰 번호로 헬퍼/요청자 각각 1개 계정 가능\n• 이메일은 계정마다 다르게 사용',
      },
      {
        question: '로그인이 안 돼요',
        answer: '로그인 문제 해결:\n\n[확인사항]\n1. 이메일 주소 정확한지 확인\n2. 비밀번호 대소문자 확인\n3. 회원가입 여부 확인\n\n[해결방법]\n• 비밀번호 틀림: "비밀번호 찾기"로 재설정\n• 계정 없음: 회원가입 진행\n• 휴면 계정: 고객센터 문의\n\n[계속 안 되면]\n• 앱 삭제 후 재설치\n• 고객센터에 이메일/전화번호 알려주세요',
      },
      {
        question: '이메일을 변경하고 싶어요',
        answer: '이메일 변경 안내:\n\n이메일은 계정의 고유 식별자로 직접 변경이 어렵습니다.\n\n[변경이 필요한 경우]\n• 고객센터에 변경 요청\n• 본인 확인 후 처리\n• 처리 시간: 1-2영업일\n\n[필요 정보]\n• 현재 이메일\n• 변경할 이메일\n• 가입 시 등록한 전화번호',
      },
    ],
  },
  {
    id: 'order',
    title: '오더/매칭',
    icon: 'briefcase-outline',
    items: [
      {
        question: '오더 취소는 어떻게 하나요?',
        answer: '오더 취소 방법:\n\n[요청자 - 오더 취소]\n• 헬퍼 선택 전: 오더 상세 > "취소" 버튼\n  → 계약금 100% 환불\n• 헬퍼 선택 후: 환불 불가 (0%)\n  → 사유: 헬퍼가 다른 오더를 포기하고 해당 오더에 배정되었기 때문입니다.\n\n[헬퍼 - 지원 취소]\n• 선택 전: 오더등록 탭 > "지원취소"\n• 선택 후: 요청자와 협의 필요\n\n[환불 처리]\n• 카드 결제: 3-5영업일\n• 계좌이체: 1-2영업일',
      },
      {
        question: '헬퍼가 지원하지 않아요',
        answer: '지원자가 없을 때 해결방법:\n\n[원인 분석]\n• 단가가 시세보다 낮은 경우\n• 지역이 외진 경우\n• 일정이 급한 경우\n• 조건이 까다로운 경우\n\n[해결방법]\n1. 단가 올리기\n   - 시세 대비 10-20% 상향\n\n2. 조건 완화\n   - 차량 종류 범위 확대\n   - 시간 유연하게 조정\n\n3. 긴급 오더로 변경\n   - 우선 노출됨\n   - 할증 적용\n\n[오더 만료]\n• 7일간 지원자 없으면 자동 만료\n• 계약금 환불 처리',
      },
      {
        question: '지원을 취소하고 싶어요 (헬퍼)',
        answer: '지원 취소 방법 (헬퍼):\n\n[선택 전]\n• 오더등록 탭 > 지원대기 오더 선택\n• "지원취소" 버튼 터치\n• 확인 후 취소 완료\n\n[선택 후]\n• 직접 취소 불가\n• 요청자에게 연락하여 협의\n• 합의 후 고객센터에 요청\n\n[무단 취소 패널티]\n• 경고 누적 시 활동 제한\n• 매칭 우선순위 하락\n• 심한 경우 계정 정지',
      },
      {
        question: '오더 조건을 수정하고 싶어요',
        answer: '오더 수정 방법:\n\n[수정 가능 시점]\n• 헬퍼 선택 전까지만 가능\n\n[수정 방법]\n오더등록 탭 > 해당 오더 > "수정"\n\n[수정 가능 항목]\n• 작업 일자/시간\n• 예상 물량\n• 단가\n• 특이사항\n• 차량 조건\n\n[수정 불가 항목]\n• 택배사 변경 (취소 후 재등록)\n\n[헬퍼 선택 후]\n• 수정 불가\n• 협의 필요시 고객센터 문의',
      },
      {
        question: '매칭이 취소되었어요',
        answer: '매칭 취소 사유:\n\n[자동 취소]\n• 헬퍼가 QR 체크인을 하지 않음\n• 양측 합의로 취소\n• 관리자 판단으로 취소\n\n[취소 후 처리]\n• 요청자: 오더 재공개 또는 환불\n• 헬퍼: 다른 오더 지원 가능\n\n[재매칭]\n• 오더 상세 > "재공개" 버튼\n• 새로운 헬퍼 지원 대기',
      },
      {
        question: '오더가 보이지 않아요',
        answer: '오더가 안 보이는 경우:\n\n[확인사항]\n1. 서류 승인이 완료되었는지\n2. 앱이 최신 버전인지\n3. 필터가 설정되어 있는지\n4. 인터넷 연결 상태\n\n[해결방법]\n• 서류 미승인: 나의정보에서 승인 상태 확인\n• 필터 해제: 홈 화면 필터 초기화\n• 앱 새로고침: 화면 아래로 당기기\n• 재로그인: 로그아웃 후 다시 로그인',
      },
    ],
  },
  {
    id: 'payment',
    title: '결제/정산',
    icon: 'card-outline',
    items: [
      {
        question: '계약금은 언제 결제하나요?',
        answer: '계약금 결제 안내:\n\n[계약금이란?]\n• 오더 총액의 20%\n• 오더 공개를 위한 선결제\n\n[결제 시점]\n• 오더 등록 직후\n• 결제 완료해야 헬퍼에게 오더 노출\n\n[결제 방법]\n• 등록된 카드로 결제\n• 또는 가상계좌 입금\n\n[미결제 시]\n• 오더가 공개되지 않음\n• 헬퍼 지원 불가\n• 24시간 내 미결제 시 오더 자동 삭제',
      },
      {
        question: '잔금은 언제 결제하나요?',
        answer: '잔금 결제 안내:\n\n[잔금이란?]\n• 총액 - 계약금\n• 마감 승인 후 결제\n\n[결제 시점]\n• 헬퍼 마감 제출 완료\n• 요청자 마감 승인 후\n\n[잔금 계산]\n실제 배송 박스 수 × 단가 = 공급가액\n공급가액 × 1.1 = 총액\n총액 - 계약금 = 잔금\n\n[주의]\n• 실제 박스 수 기준으로 재계산됨\n• 예상보다 많으면 잔금 증가\n• 예상보다 적으면 잔금 감소',
      },
      {
        question: '환불은 어떻게 받나요?',
        answer: '환불 정책 안내:\n\n[환불 기준]\n• 헬퍼 선택 전 취소: 100% 환불\n• 헬퍼 선택 후 취소: 환불 불가 (0%)\n  → 사유: 헬퍼가 다른 오더를 포기하고 해당 오더에 배정되었기 때문입니다.\n• 업무 시작 후: 협의 필요\n\n[환불 처리]\n• 카드 결제: 결제 취소로 3-5영업일\n• 계좌이체: 등록 계좌로 1-2영업일\n\n[환불 확인]\n• 사용 이력에서 환불 내역 확인\n• 환불 완료 시 푸시 알림\n\n[환불 불가]\n• 업무 완료 후\n• 마감 승인 완료 후',
      },
      {
        question: '정산은 언제 되나요? (헬퍼)',
        answer: '헬퍼 정산 안내:\n\n[정산 조건]\n1. 마감 제출 완료\n2. 요청자 마감 승인\n3. 요청자 잔금 결제 완료\n\n[정산 시점]\n• 잔금 결제 완료 후 익영업일\n• 공휴일 제외\n\n[정산 금액]\n총액 - 플랫폼 수수료 = 헬퍼 수령액\n\n[정산 확인]\n• 나의정보 > 업무확인서\n• 월별/일별 정산 내역 확인',
      },
      {
        question: '세금계산서를 받고 싶어요',
        answer: '세금계산서 발행 안내:\n\n[발행 조건]\n• 사업자 정보 등록 완료\n• 결제 완료된 거래\n\n[등록 방법]\n나의정보 > 결제 정보\n• 사업자등록번호\n• 상호명, 대표자명\n• 사업장 주소\n• 담당자 이메일\n\n[발행 시기]\n• 월말 일괄 발행\n• 익월 10일까지 발송\n\n[수신]\n• 등록한 이메일로 발송\n• 국세청 홈택스에서도 조회 가능',
      },
      {
        question: '결제가 안 돼요',
        answer: '결제 실패 해결:\n\n[확인사항]\n1. 카드 한도 초과 여부\n2. 카드 유효기간\n3. 결제 비밀번호\n4. 해외결제 차단 여부\n\n[해결방법]\n• 다른 카드로 시도\n• 카드사에 결제 승인 요청\n• 가상계좌로 결제 방법 변경\n\n[가상계좌 결제]\n• 결제 화면에서 "계좌이체" 선택\n• 가상계좌 발급\n• 입금 시 자동 결제 처리\n\n[계속 실패 시]\n• 고객센터 문의',
      },
      {
        question: '정산 금액이 다른 것 같아요',
        answer: '정산 금액 확인:\n\n[정산 금액 구성]\n공급가액 = 실제 박스 수 × 단가\n부가세 = 공급가액 × 10%\n총액 = 공급가액 + 부가세\n플랫폼 수수료 차감\n= 최종 정산액\n\n[금액 불일치 사유]\n• 실제 박스 수와 예상 물량 차이\n• 반품 차감\n• 플랫폼 수수료\n• 차감 공제 (파손 등)\n\n[이의제기]\n• 나의정보 > 이의제기 접수\n• 상세 내역과 함께 접수\n• 관리자 검토 후 조정',
      },
    ],
  },
  {
    id: 'closing',
    title: '마감/업무',
    icon: 'check-all',
    items: [
      {
        question: '마감 제출은 어떻게 하나요?',
        answer: '마감 제출 방법 (헬퍼):\n\n[제출 위치]\n마감확인 탭 > 해당 오더 선택\n\n[입력 항목]\n1. 배송 완료 건수\n2. 반품 건수 (있는 경우)\n3. 배송 이력 이미지 (필수)\n   - 쿠팡앱/배송앱 캡처\n   - 배송 완료 건수 표시\n4. 기타 이미지 (선택)\n   - 특이사항 증빙\n\n[제출 완료]\n• "마감 제출" 버튼 터치\n• 요청자에게 알림 발송\n• 요청자 승인 대기',
      },
      {
        question: '마감 내용을 수정하고 싶어요',
        answer: '마감 수정 방법:\n\n[제출 전]\n• 입력 내용 자유롭게 수정 가능\n• 이미지 추가/삭제 가능\n\n[제출 후]\n• 직접 수정 불가\n• 요청자에게 반려 요청 필요\n• 반려 후 수정하여 재제출\n\n[반려 요청 방법]\n• 요청자에게 연락\n• 반려 사유 설명\n• 요청자가 "반려" 버튼 터치\n• 반려 후 마감 재제출',
      },
      {
        question: '출근 체크가 안 돼요',
        answer: 'QR 체크인 문제 해결:\n\n[QR 스캔 안 될 때]\n• 카메라 권한 확인\n• QR 코드가 선명한지 확인\n• 조명 충분한지 확인\n• 카메라 렌즈 청결\n\n[대안]\n• 12자리 코드 직접 입력\n• 요청자에게 코드 확인 요청\n\n[코드 입력 방법]\n1. QR 스캔 화면에서\n2. "코드 직접 입력" 선택\n3. 12자리 숫자 입력\n4. 확인 버튼\n\n[계속 안 되면]\n• 앱 재시작\n• 고객센터 문의',
      },
      {
        question: '마감 확인이 안 돼요 (요청자)',
        answer: '마감 확인 문제 해결:\n\n[마감이 안 보이는 경우]\n• 헬퍼가 아직 마감 제출 안 함\n• 앱 새로고침 (화면 아래로 당기기)\n\n[확인 방법]\n마감확인 탭 > 해당 오더 선택\n• 제출된 내역 확인\n• 승인 또는 반려 선택\n\n[승인/반려]\n• 승인: 잔금 결제 진행\n• 반려: 사유 입력 후 헬퍼에게 알림',
      },
      {
        question: '마감이 반려되었어요',
        answer: '마감 반려 시 대응 (헬퍼):\n\n[반려 확인]\n• 푸시 알림으로 반려 알림\n• 마감확인 탭에서 반려 사유 확인\n\n[흔한 반려 사유]\n• 배송 건수 불일치\n• 이미지가 불분명함\n• 반품 수량 오류\n• 정보 누락\n\n[재제출]\n1. 반려된 오더 선택\n2. 반려 사유 확인\n3. 내용 수정\n4. "마감 제출" 다시 터치\n\n[문제 해결]\n• 사유가 이해 안 되면 요청자 연락\n• 계속 반려되면 고객센터 문의',
      },
      {
        question: '배송 이력 이미지는 뭘 찍나요?',
        answer: '배송 이력 이미지 안내:\n\n[필수 첨부]\n배송 앱의 완료 화면 캡처\n\n[캡처 예시]\n• 쿠팡: 배송현황 > 완료 건수 표시\n• CJ대한통운: 업무 완료 화면\n• 롯데택배: 배송 실적 화면\n• 기타: 배송 완료 건수가 보이는 화면\n\n[주의사항]\n• 날짜와 건수가 선명하게 보여야 함\n• 캡처 시 상태바(시간) 포함 권장\n• 여러 장 첨부 가능\n\n[기타 이미지]\n• 특이사항 증빙 (파손, 반품 등)\n• 선택 사항',
      },
    ],
  },
  {
    id: 'app',
    title: '앱 사용',
    icon: 'cellphone',
    items: [
      {
        question: '알림이 안 와요',
        answer: '푸시 알림 설정:\n\n[앱 내 설정]\n나의정보 > 앱 설정\n• 푸시 알림 on/off 확인\n• 알림 종류별 설정\n\n[기기 설정]\niOS: 설정 > 헬프미 > 알림 허용\nAndroid: 설정 > 앱 > 헬프미 > 알림 허용\n\n[확인사항]\n• 방해금지 모드 해제\n• 배터리 절약 모드 해제\n• 백그라운드 앱 새로고침 허용\n\n[계속 안 오면]\n• 로그아웃 후 재로그인\n• 앱 삭제 후 재설치',
      },
      {
        question: '앱이 느리거나 오류가 발생해요',
        answer: '앱 오류 해결:\n\n[기본 해결책]\n1. 앱 완전 종료 후 재시작\n2. 로그아웃 후 다시 로그인\n3. 앱 캐시 삭제 (설정 > 앱 > 헬프미)\n4. 앱 삭제 후 재설치\n\n[확인사항]\n• 인터넷 연결 상태\n• 앱 최신 버전 여부\n• 기기 저장공간 여유\n\n[오류 신고]\n• 오류 화면 캡처\n• 고객센터에 증상 설명\n• 사용 기기 정보 함께 전달',
      },
      {
        question: '서류 승인은 얼마나 걸리나요?',
        answer: '서류 승인 안내:\n\n[승인 소요 시간]\n• 제출 후 1-2영업일\n• 주말/공휴일 제외\n\n[승인 결과]\n• 승인: 푸시 알림 + 상태 변경\n• 반려: 반려 사유와 함께 알림\n\n[반려된 경우]\n• 반려 사유 확인\n• 서류 재제출\n• 다시 1-2영업일 소요\n\n[흔한 반려 사유]\n• 서류가 불분명함\n• 정보가 일치하지 않음\n• 유효기간 만료',
      },
      {
        question: '앱 버전을 확인하고 싶어요',
        answer: '앱 버전 확인:\n\n[확인 방법]\n나의정보 화면 하단\n→ 버전 정보 표시\n\n[업데이트 방법]\niOS: App Store > 업데이트 탭\nAndroid: Play Store > 내 앱 > 업데이트\n\n[자동 업데이트]\n• 앱스토어 설정에서 자동 업데이트 설정\n• 중요 업데이트는 앱 실행 시 안내',
      },
      {
        question: '데이터 사용량이 많은가요?',
        answer: '데이터 사용 안내:\n\n[주요 데이터 사용]\n• 오더 목록 새로고침\n• 이미지 업로드/다운로드\n• 푸시 알림 수신\n\n[데이터 절약]\n• Wi-Fi 환경에서 이미지 업로드\n• 불필요한 새로고침 자제\n\n[대략적 사용량]\n• 일반 사용: 월 50-100MB\n• 이미지 많이 올리면: 월 200MB+\n\n[참고]\n• 영상 기능 없어 데이터 사용 적음\n• 이미지 업로드가 가장 많이 사용',
      },
    ],
  },
  {
    id: 'etc',
    title: '기타',
    icon: 'help-circle-outline',
    items: [
      {
        question: '고객센터 연락처가 어떻게 되나요?',
        answer: '고객센터 안내:\n\n[카카오톡 상담] (추천)\n채널: @hellpme\n• 빠른 실시간 상담\n• 운영시간 외 접수 가능\n\n[전화 상담]\n1588-0000\n• 평일 09:00-18:00\n• 점심시간 12:00-13:00 제외\n• 주말/공휴일 휴무\n\n[이메일 문의]\nsupport@hellpme.com\n• 24시간 접수 가능\n• 1-2영업일 내 답변\n\n[문의 시 필요 정보]\n• 가입 이메일 또는 전화번호\n• 문의 내용 상세 설명\n• 관련 스크린샷 (있으면)',
      },
      {
        question: '이용약관과 개인정보처리방침은 어디서 보나요?',
        answer: '약관 확인 방법:\n\n[확인 위치]\n나의정보 > 지원 섹션\n• 이용약관\n• 개인정보 처리방침\n\n[주요 내용]\n[이용약관]\n• 서비스 이용 규정\n• 회원의 권리와 의무\n• 서비스 제공 조건\n\n[개인정보 처리방침]\n• 수집하는 개인정보 항목\n• 개인정보 이용 목적\n• 보유 및 이용 기간\n• 제3자 제공 여부',
      },
      {
        question: '신고는 어떻게 하나요?',
        answer: '부정행위 신고:\n\n[신고 대상]\n• 허위 정보 등록\n• 무단 취소/불이행\n• 비정상적인 거래\n• 사기 의심 행위\n\n[신고 방법]\n1. 고객센터 문의\n2. 신고 내용 상세 설명\n3. 증빙 자료 첨부 (캡처 등)\n\n[처리 절차]\n• 관리자 검토 (1-3영업일)\n• 상대방 확인\n• 조치 및 결과 통보\n\n[조치 내용]\n• 경고, 활동 제한, 계정 정지 등\n• 심각한 경우 영구 이용 제한',
      },
      {
        question: '헬프미는 어떤 회사인가요?',
        answer: '헬프미 소개:\n\n[서비스]\n• 배송 대행 매칭 플랫폼\n• 헬퍼(배송기사)와 요청자(사업체) 연결\n• 투명한 정산 및 관리 시스템\n\n[특징]\n• 검증된 헬퍼 풀\n• 안전한 결제 시스템\n• 실시간 업무 관리\n• 리뷰/평점 시스템\n\n[운영 원칙]\n• 공정한 매칭\n• 투명한 정산\n• 안전한 거래\n• 신속한 고객 지원\n\n[문의]\nsupport@hellpme.com',
      },
      {
        question: '제휴/협력 문의는 어디로 하나요?',
        answer: '제휴 문의 안내:\n\n[제휴 대상]\n• 물류 업체\n• 택배 대리점\n• 기업 고객\n• 마케팅 제휴\n\n[문의 방법]\n이메일: partnership@hellpme.com\n\n[문의 내용]\n• 회사/개인 소개\n• 제휴 제안 내용\n• 연락처\n\n[처리]\n• 검토 후 1주일 내 연락\n• 적합한 경우 미팅 진행',
      },
    ],
  },
];

const SUPPORT_EMAIL = 'support@hellpme.com';
const KAKAO_CHANNEL = 'https://pf.kakao.com/_hellpme';

export default function SupportScreen({ navigation }: SupportScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();

  const isHelper = user?.role === 'helper';
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;

  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const toggleItem = (itemKey: string) => {
    setExpandedItems(prev => 
      prev.includes(itemKey) 
        ? prev.filter(key => key !== itemKey)
        : [...prev, itemKey]
    );
  };

  const handleKakao = () => {
    Linking.openURL(KAKAO_CHANNEL).catch(() => {
      Alert.alert('알림', '카카오톡 채널을 열 수 없습니다.');
    });
  };

  const handleEmail = () => {
    const subject = encodeURIComponent('[헬프미] 문의드립니다');
    const body = encodeURIComponent(`\n\n---\n사용자 ID: ${user?.id || 'N/A'}\n역할: ${isHelper ? '헬퍼' : '요청자'}`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('알림', `이메일 앱을 열 수 없습니다.\n${SUPPORT_EMAIL}로 문의해주세요.`);
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Card variant="glass" padding="xl" style={styles.introCard}>
        <View style={[styles.introIcon, { backgroundColor: isHelper ? BrandColors.helperLight : BrandColors.requesterLight }]}>
          <Icon name="chatbox-outline" size={32} color={primaryColor} />
        </View>
        <ThemedText style={[styles.introTitle, { color: theme.text }]}>
          자주 묻는 질문
        </ThemedText>
        <ThemedText style={[styles.introSubtitle, { color: theme.tabIconDefault }]}>
          궁금한 점을 빠르게 해결하세요
        </ThemedText>
      </Card>

      {FAQ_SECTIONS.map((section) => {
        const isSectionExpanded = expandedSections.includes(section.id);
        
        return (
          <View key={section.id} style={styles.sectionContainer}>
            <Card variant="glass" padding="lg" style={styles.sectionHeader} onPress={() => toggleSection(section.id)}>
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionIcon, { backgroundColor: isHelper ? BrandColors.helperLight : BrandColors.requesterLight }]}>
                  <Icon name={section.icon as any} size={20} color={primaryColor} />
                </View>
                <View>
                  <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                    {section.title}
                  </ThemedText>
                  <ThemedText style={[styles.sectionCount, { color: theme.tabIconDefault }]}>
                    {section.items.length}개 질문
                  </ThemedText>
                </View>
              </View>
              <Icon 
                name={isSectionExpanded ? "chevron-up-outline" : "chevron-down-outline"} 
                size={20} 
                color={theme.tabIconDefault} 
              />
            </Card>

            {isSectionExpanded ? (
              <View style={styles.itemsContainer}>
                {section.items.map((item, index) => {
                  const itemKey = `${section.id}-${index}`;
                  const isItemExpanded = expandedItems.includes(itemKey);

                  return (
                    <Pressable 
                      key={itemKey} 
                      onPress={() => toggleItem(itemKey)}
                      style={[styles.itemCard, { backgroundColor: theme.backgroundDefault }]}
                    >
                      <View style={styles.itemHeader}>
                        <ThemedText style={[styles.itemQuestion, { color: theme.text }]}>
                          Q. {item.question}
                        </ThemedText>
                        <Icon 
                          name={isItemExpanded ? "remove-outline" : "add-outline"} 
                          size={20} 
                          color={primaryColor} 
                        />
                      </View>
                      {isItemExpanded ? (
                        <ThemedText style={[styles.itemAnswer, { color: theme.tabIconDefault }]}>
                          {item.answer}
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}

      <Card variant="glass" padding="xl" style={styles.contactCard}>
        <ThemedText style={[styles.contactTitle, { color: theme.text }]}>
          원하는 답변을 찾지 못하셨나요?
        </ThemedText>
        <View style={styles.contactButtons}>
          <Pressable 
            style={[styles.contactButton, { backgroundColor: 'BrandColors.warning' }]}
            onPress={handleKakao}
          >
            <Icon name="chatbox-outline" size={18} color="Colors.dark.backgroundSecondary" />
            <ThemedText style={[styles.contactButtonText, { color: 'Colors.dark.backgroundSecondary' }]}>카카오톡 상담</ThemedText>
          </Pressable>
          <Pressable 
            style={[styles.contactButton, { backgroundColor: primaryColor }]}
            onPress={handleEmail}
          >
            <Icon name="mail-outline" size={18} color={Colors.light.buttonText} />
            <ThemedText style={styles.contactButtonTextWhite}>이메일 문의</ThemedText>
          </Pressable>
        </View>
        <ThemedText style={[styles.contactInfo, { color: theme.tabIconDefault }]}>
          전화: 1588-0000 (평일 09:00-18:00)
        </ThemedText>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  introCard: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  introIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  introTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  introSubtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  sectionContainer: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    ...Typography.body,
    fontWeight: '600',
  },
  sectionCount: {
    ...Typography.small,
    marginTop: 2,
  },
  itemsContainer: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  itemCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemQuestion: {
    ...Typography.body,
    flex: 1,
    marginRight: Spacing.md,
    fontWeight: '500',
  },
  itemAnswer: {
    ...Typography.body,
    marginTop: Spacing.md,
    lineHeight: 24,
  },
  contactCard: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  contactTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.lg,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  contactButtonText: {
    ...Typography.body,
    fontWeight: '600',
  },
  contactButtonTextWhite: {
    ...Typography.body,
    color: Colors.light.buttonText,
    fontWeight: '600',
  },
  contactInfo: {
    ...Typography.small,
  },
});
