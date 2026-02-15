import React, { useState } from "react";
import { View, Pressable, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";

type HelpScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface HelpSection {
  id: string;
  title: string;
  icon: string;
  items: HelpItem[];
}

interface HelpItem {
  question: string;
  answer: string;
}

const HELPER_HELP_SECTIONS: HelpSection[] = [
  {
    id: 'app-overview',
    title: '앱 소개',
    icon: 'information-outline',
    items: [
      {
        question: '헬프미란 무엇인가요?',
        answer: '헬프미는 배송 대행 전문 플랫폼입니다. 택배사, 쿠팡, 편의점 물류 등 다양한 배송 업무를 헬퍼(배송 기사)와 요청자(사업체)를 안전하게 연결합니다.\n\n• 투명한 정산 시스템\n• 체계적인 업무 관리\n• 평점/리뷰 시스템\n• 실시간 알림 서비스',
      },
      {
        question: '헬퍼로 활동하면 어떤 점이 좋나요?',
        answer: '헬프미 헬퍼의 장점:\n\n1. 자율적인 일정 관리\n   - 원하는 지역, 시간대의 오더를 직접 선택\n   - 본인 일정에 맞춰 유연하게 활동\n\n2. 투명한 정산\n   - 단가가 명확하게 표시됨\n   - 마감 승인 후 빠른 정산\n\n3. 경력 관리\n   - 평점과 리뷰로 실력을 증명\n   - 우수 헬퍼 우대 혜택\n\n4. 팀 활동\n   - 팀을 구성하여 함께 지원 가능\n   - 팀 단위 정산 관리',
      },
      {
        question: '어떤 택배사 오더가 있나요?',
        answer: '헬프미에서 취급하는 택배사:\n\n[일반 택배]\n• CJ대한통운 (주간/새벽)\n• 롯데택배\n• 한진택배\n• 로젠택배\n• 우체국택배\n• 경동택배\n• 대신택배\n• 일양로지스\n\n[쿠팡]\n• 쿠팡 주간\n• 쿠팡 새벽\n• 쿠팡 야간\n• 쿠팡생수\n\n[편의점/기타]\n• CVSnet 편의점택배\n• 홈픽택배\n• 기타 택배\n\n[냉동/냉장]\n• 전문냉동\n• CU냉동, GS냉동, 세븐일레븐냉동\n• 이마트/롯데마트/홈플러스냉동\n• 코스트코냉동',
      },
      {
        question: '단가는 어떻게 책정되나요?',
        answer: '단가는 택배사와 물량에 따라 다릅니다:\n\n[기본 단가 예시]\n• 일반 택배: 박스당 1,200원~\n• 쿠팡 주간/생수: 박스당 1,400원~\n• 쿠팡 새벽/야간: 박스당 1,600원~\n• 기타 택배: 박스당 1,800원~\n• 냉동/냉장: 박스당 2,500원~\n\n* 긴급 오더는 할증이 적용됩니다.\n* 최종 단가는 요청자가 제시합니다.',
      },
    ],
  },
  {
    id: 'getting-started',
    title: '시작하기',
    icon: 'send-outline',
    items: [
      {
        question: '헬프미 앱 사용 단계',
        answer: '헬퍼 활동을 시작하는 방법:\n\n[1단계] 회원가입\n• 이메일/비밀번호 입력\n• 휴대폰 본인인증\n• 기본 정보 입력 (이름, 차량 정보 등)\n\n[2단계] 서류 제출\n• 사업자등록증\n• 운전면허증\n• 차량등록증\n* 모든 서류는 선명하게 촬영해주세요\n\n[3단계] 승인 대기\n• 관리자 검토 (1-2영업일)\n• 승인 완료 시 푸시 알림\n\n[4단계] 오더 지원\n• 홈 화면에서 오더 확인\n• 조건 확인 후 지원\n\n[5단계] 업무 시작\n• 요청자에게 선택되면 알림\n• QR 체크인 후 업무 시작',
      },
      {
        question: '서류 제출 방법',
        answer: '필요 서류 및 제출 방법:\n\n[필수 서류]\n1. 사업자등록증\n   - 개인사업자 또는 법인사업자\n   - 최신 발급본 권장\n\n2. 운전면허증\n   - 1종 보통 이상\n   - 유효기간 확인\n\n3. 차량등록증\n   - 본인 명의 또는 회사 명의\n   - 차량 종류 확인 (봉고, 포터, 탑차 등)\n\n[제출 방법]\n나의정보 > 서류 제출\n→ 각 서류 촬영 또는 갤러리에서 선택\n→ 업로드 후 제출 완료\n\n[주의사항]\n• 서류가 흐리거나 잘린 경우 반려될 수 있습니다\n• 승인까지 1-2영업일 소요',
      },
      {
        question: '승인 상태 확인 방법',
        answer: '승인 상태는 여러 곳에서 확인할 수 있습니다:\n\n[확인 방법]\n1. 나의정보 화면 상단\n   - 현재 승인 상태 표시\n   - 대기중/승인됨/반려\n\n2. 푸시 알림\n   - 승인 완료 시 알림 발송\n   - 반려 시 사유와 함께 알림\n\n3. 서류 제출 화면\n   - 각 서류별 승인 상태 확인\n\n[승인 후]\n• 홈 화면에서 오더 목록 확인 가능\n• 오더 지원 가능\n• 팀 생성/가입 가능',
      },
      {
        question: '프로필 설정하기',
        answer: '프로필 정보 관리:\n\n[기본 정보]\n나의정보 > 프로필 수정\n• 이름, 연락처\n• 활동 지역\n• 차량 정보 (차종, 번호)\n\n[계좌 정보]\n나의정보 > 환불 계좌\n• 정산받을 계좌 등록\n• 예금주, 은행, 계좌번호\n\n[알림 설정]\n나의정보 > 앱 설정\n• 푸시 알림 on/off\n• 알림 종류별 설정\n\n[팁]\n• 프로필 사진을 등록하면 신뢰도가 올라갑니다\n• 활동 지역을 정확히 설정하면 맞춤 오더를 받을 수 있습니다',
      },
    ],
  },
  {
    id: 'jobs',
    title: '오더 지원하기',
    icon: 'briefcase-outline',
    items: [
      {
        question: '오더 목록 확인하기',
        answer: '오더를 찾는 방법:\n\n[홈 화면]\n• 현재 지원 가능한 오더 목록\n• 지역, 날짜, 택배사별 필터\n• 새 오더 알림 표시\n\n[오더 정보 확인]\n• 택배사 (CJ, 롯데, 쿠팡 등)\n• 배송 지역 (시/군/구)\n• 작업일 및 시간\n• 예상 물량 (박스 수)\n• 단가 (박스당 금액)\n• 필요 차량 종류\n• 긴급 여부\n\n[오더 상세]\n• 오더 카드 터치 → 상세 화면\n• 요청자 정보, 상세 주소, 특이사항 확인',
      },
      {
        question: '오더 지원 방법',
        answer: '오더에 지원하는 방법:\n\n[지원 절차]\n1. 홈 화면에서 오더 선택\n2. 상세 내용 확인\n3. "지원하기" 버튼 터치\n4. 지원 완료!\n\n[지원 후]\n• 오더등록 탭에서 지원 현황 확인\n• 요청자가 검토 후 선택\n• 선택되면 푸시 알림 발송\n\n[주의사항]\n• 오더당 최대 3명까지 지원 가능\n• 요청자가 1명만 선택함\n• 다른 헬퍼가 선택되면 자동 거절됨\n• 동시에 여러 오더 지원 가능',
      },
      {
        question: '지원 현황 확인하기',
        answer: '내 지원 현황 확인:\n\n[오더등록 탭]\n상태별로 오더 확인 가능:\n\n• 지원대기: 요청자 검토 중\n• 매칭완료: 선택되어 업무 예정\n• 업무중: 현재 진행 중인 업무\n• 마감대기: 마감 제출 대기\n• 완료: 정산 완료된 오더\n\n[각 오더 상세]\n• 현재 상태 및 진행 단계\n• 요청자 연락처\n• QR 체크인 버튼\n• 마감 제출 버튼',
      },
      {
        question: '지원 취소하기',
        answer: '지원을 취소하는 방법:\n\n[취소 가능 시점]\n• 요청자가 선택하기 전까지만 가능\n• 선택된 후에는 직접 취소 불가\n\n[취소 방법]\n1. 오더등록 탭 > 지원대기 오더 선택\n2. "지원취소" 버튼 터치\n3. 확인 후 취소 완료\n\n[선택 후 취소]\n• 요청자에게 연락하여 협의\n• 합의 후 고객센터에 요청\n• 무단 취소 시 패널티 부과될 수 있음\n\n[패널티]\n• 무단 취소 3회 이상: 활동 제한\n• 지원 취소율이 높으면 매칭 불이익',
      },
    ],
  },
  {
    id: 'work',
    title: '업무 진행',
    icon: 'truck-outline',
    items: [
      {
        question: 'QR 출근 체크하기',
        answer: '출근 체크 방법:\n\n[QR 스캔]\n1. 오더등록 탭에서 해당 오더 선택\n2. "QR 체크인" 버튼 터치\n3. 카메라로 요청자의 QR 코드 스캔\n4. 체크인 완료!\n\n[코드 직접 입력]\n• QR 스캔이 어려운 경우\n• 12자리 코드를 직접 입력\n• 요청자에게 코드 확인\n\n[체크인 후]\n• 오더 상태가 "업무중"으로 변경\n• 요청자에게 알림 발송\n• 이제 배송 업무를 시작하세요!',
      },
      {
        question: '배송 업무 진행하기',
        answer: '업무 중 주의사항:\n\n[배송 전]\n• 물량 인수 시 박스 수량 확인\n• 파손/오배송 물품 체크\n• 특이사항 요청자에게 전달\n\n[배송 중]\n• 안전 운전\n• 물품 취급 주의\n• 배송 완료 시 사진 촬영 권장\n\n[배송 후]\n• 미배송/반품 물품 정리\n• 배송 이력 캡처 (쿠팡앱 등)\n• 마감 제출 준비\n\n[문제 발생 시]\n• 요청자에게 즉시 연락\n• 파손/분실 시 사진 촬영\n• 고객센터 문의',
      },
      {
        question: '마감 제출하기',
        answer: '마감 제출 방법:\n\n[마감확인 탭]\n1. 마감 제출할 오더 선택\n2. 배송 건수 입력\n3. 반품 건수 입력 (있는 경우)\n4. 배송 이력 이미지 첨부 (필수)\n5. 기타 이미지 첨부 (선택)\n6. "마감 제출" 버튼 터치\n\n[필수 첨부물]\n• 배송 이력 이미지\n  - 쿠팡앱 캡처 등\n  - 배송 완료 건수가 보이도록\n\n[제출 후]\n• 요청자가 검토 후 승인/반려\n• 승인되면 정산 진행\n• 반려 시 수정하여 재제출',
      },
      {
        question: '마감이 반려된 경우',
        answer: '마감 반려 시 대응:\n\n[반려 확인]\n• 푸시 알림으로 반려 알림\n• 마감확인 탭에서 반려 사유 확인\n\n[재제출]\n1. 반려된 오더 선택\n2. 반려 사유 확인\n3. 내용 수정\n4. 다시 "마감 제출"\n\n[흔한 반려 사유]\n• 배송 건수 불일치\n• 이미지가 불분명함\n• 반품 수량 오류\n\n[문제 해결]\n• 반려 사유가 이해되지 않으면 요청자에게 연락\n• 계속 문제가 있으면 고객센터 문의',
      },
    ],
  },
  {
    id: 'checkin',
    title: 'QR 코드',
    icon: 'qrcode',
    items: [
      {
        question: '내 QR 코드 확인하기',
        answer: '개인 QR 코드 확인:\n\n[확인 방법]\n나의정보 > 내 QR 코드\n\n[QR 코드 정보]\n• 개인 고유 코드 (변경 불가)\n• 화면에 QR 코드 표시\n• 아래에 12자리 숫자 코드 표시\n\n[사용 용도]\n• 출근 체크 시 요청자에게 보여줌\n• 본인 확인용\n\n[주의]\n• 타인에게 공유하지 마세요\n• 해당 코드로 출근 체크가 진행됩니다',
      },
      {
        question: 'QR 스캔이 안 되는 경우',
        answer: 'QR 스캔 문제 해결:\n\n[확인사항]\n1. 카메라 권한 허용 여부\n2. QR 코드가 화면에 선명한지\n3. 조명이 충분한지\n4. 카메라 렌즈 청결 상태\n\n[대안]\n• 12자리 코드 직접 입력\n• 요청자에게 코드 확인 요청\n\n[코드 입력 방법]\n1. QR 스캔 화면에서\n2. "코드 직접 입력" 선택\n3. 12자리 숫자 입력\n4. 확인 버튼 터치\n\n[계속 안 되면]\n• 앱 재시작 후 다시 시도\n• 고객센터 문의',
      },
    ],
  },
  {
    id: 'team',
    title: '팀 관리',
    icon: 'account-group-outline',
    items: [
      {
        question: '팀 만들기',
        answer: '새 팀을 생성하는 방법:\n\n[팀 생성]\n1. 나의정보 > 팀 관리\n2. "새 팀 만들기" 버튼\n3. 팀 이름 입력\n4. 생성 완료!\n\n[팀장 권한]\n• 팀원 초대/제외\n• 팀 정보 수정\n• 팀 단위 지원\n\n[팀 혜택]\n• 팀으로 오더 지원 가능\n• 팀원 정산 내역 확인\n• 효율적인 인력 관리',
      },
      {
        question: '팀원 초대하기',
        answer: '팀원을 초대하는 방법:\n\n[초대 방법]\n1. 팀 관리 화면 접속\n2. "멤버 초대" 버튼\n3. 초대할 헬퍼의 전화번호 입력\n4. 초대 발송\n\n[초대 받은 경우]\n• 푸시 알림으로 초대 알림\n• 팀 관리에서 수락/거절 선택\n\n[주의사항]\n• 초대 대상은 헬프미 가입자여야 함\n• 승인된 헬퍼만 초대 가능\n• 한 팀에 최대 10명',
      },
      {
        question: '팀으로 오더 지원하기',
        answer: '팀 단위로 지원하는 방법:\n\n[팀 지원]\n1. 홈에서 오더 선택\n2. 상세 화면에서 "팀으로 지원" 선택\n3. 함께 지원할 팀원 선택\n4. 지원 완료\n\n[팀 지원 장점]\n• 대량 물량 오더에 유리\n• 팀원 역할 분담 가능\n• 정산도 팀 단위로 관리\n\n[주의]\n• 팀장만 팀 지원 가능\n• 선택된 팀원 모두 일정 확인 필요',
      },
    ],
  },
  {
    id: 'payment',
    title: '정산',
    icon: 'credit-card-outline',
    items: [
      {
        question: '정산 절차 안내',
        answer: '정산이 진행되는 과정:\n\n[정산 흐름]\n1. 마감 제출\n   - 배송 완료 후 마감 제출\n   - 배송 건수, 반품 건수, 이미지 첨부\n\n2. 마감 승인\n   - 요청자가 내용 검토\n   - 승인 또는 반려\n\n3. 잔금 결제\n   - 요청자가 잔금 결제\n   - 총액 - 계약금 = 잔금\n\n4. 정산 완료\n   - 헬퍼 계좌로 입금\n   - 익영업일 내 처리\n\n[정산 금액]\n공급가액 = 실제 박스 수 × 단가\n부가세 = 공급가액 × 10%\n총액 = 공급가액 + 부가세\n헬퍼 수령액 = 총액 - 플랫폼 수수료',
      },
      {
        question: '정산 계좌 등록하기',
        answer: '정산받을 계좌 등록:\n\n[등록 방법]\n나의정보 > 환불 계좌\n1. 은행 선택\n2. 계좌번호 입력\n3. 예금주명 입력 (본인 명의)\n4. 저장\n\n[주의사항]\n• 본인 명의 계좌만 가능\n• 사업자 계좌 등록 권장\n• 계좌정보 변경 시 즉시 반영\n\n[지원 은행]\n국민, 신한, 우리, 하나, 농협, 기업, SC제일, 씨티, 카카오뱅크, 토스뱅크 등',
      },
      {
        question: '정산 내역 확인하기',
        answer: '정산 내역 확인 방법:\n\n[업무확인서]\n나의정보 > 업무확인서\n• 월별 정산 요약\n• 달력 형태로 업무 일자 확인\n• 각 오더별 상세 정산 내역\n\n[수행 이력]\n나의정보 > 수행 이력\n• 완료된 모든 오더 목록\n• 오더별 정산 금액\n• 정산 상태 (대기/완료)\n\n[정산 상세]\n각 오더 터치 시:\n• 공급가액, 부가세, 총액\n• 플랫폼 수수료\n• 최종 수령액',
      },
      {
        question: '정산이 안 되는 경우',
        answer: '정산 지연 시 확인사항:\n\n[체크리스트]\n1. 마감이 승인되었는지 확인\n2. 요청자가 잔금을 결제했는지 확인\n3. 정산 계좌가 정확한지 확인\n\n[흔한 원인]\n• 마감 반려 상태\n• 요청자 잔금 미결제\n• 계좌 정보 오류\n• 공휴일로 인한 지연\n\n[해결 방법]\n• 마감 상태 확인 후 재제출\n• 요청자에게 잔금 결제 요청\n• 계좌 정보 재확인\n• 2영업일 이상 지연 시 고객센터 문의',
      },
    ],
  },
];

const REQUESTER_HELP_SECTIONS: HelpSection[] = [
  {
    id: 'app-overview',
    title: '앱 소개',
    icon: 'information-outline',
    items: [
      {
        question: '헬프미란 무엇인가요?',
        answer: '헬프미는 배송 대행 전문 플랫폼입니다. 택배 대리점, 물류센터, 편의점 본부 등 배송 인력이 필요한 사업체와 검증된 헬퍼(배송 기사)를 안전하게 연결합니다.\n\n[주요 기능]\n• 검증된 헬퍼 풀 제공\n• 실시간 업무 현황 확인\n• 투명한 정산 시스템\n• 리뷰/평점 시스템',
      },
      {
        question: '헬프미를 사용하면 어떤 점이 좋나요?',
        answer: '헬프미 사용 장점:\n\n1. 검증된 인력\n   - 서류 심사 완료된 헬퍼\n   - 평점/리뷰로 실력 확인\n   - 우수 헬퍼 추천\n\n2. 실시간 관리\n   - QR 출근 체크로 출근 확인\n   - 마감 내역 실시간 확인\n   - 푸시 알림으로 진행 상황 파악\n\n3. 안전한 결제\n   - 계약금/잔금 분리 결제\n   - 마감 승인 후 잔금 결제\n   - 리스크 최소화\n\n4. 편리한 정산\n   - 자동 정산 처리\n   - 세금계산서 발행 지원\n   - 정산 내역 한눈에 확인',
      },
      {
        question: '어떤 택배사 업무를 등록할 수 있나요?',
        answer: '등록 가능한 택배사:\n\n[일반 택배]\n• CJ대한통운 (주간/새벽)\n• 롯데택배, 한진택배\n• 로젠택배, 우체국택배\n• 경동택배, 대신택배\n• 일양로지스\n\n[쿠팡]\n• 쿠팡 주간/새벽/야간\n• 쿠팡생수\n\n[편의점/기타]\n• CVSnet 편의점택배\n• 홈픽택배\n• 기타 택배\n\n[냉동/냉장 전문]\n• 전문냉동\n• 편의점/마트 냉동\n• 코스트코냉동',
      },
      {
        question: '수수료는 얼마인가요?',
        answer: '헬프미 수수료 안내:\n\n[플랫폼 수수료]\n• 결제 금액의 일정 비율\n• 정확한 수수료율은 관리자 문의\n• 긴급 오더 시 별도 할증 적용 가능\n\n[결제 구성]\n• 계약금: 총액의 20%\n• 잔금: 총액의 80%\n\n[부가세]\n• 모든 금액은 부가세 별도\n• 실제 결제 시 부가세 포함\n\n* 정확한 수수료는 오더 등록 시 확인됩니다',
      },
    ],
  },
  {
    id: 'getting-started',
    title: '시작하기',
    icon: 'send-outline',
    items: [
      {
        question: '헬프미 앱 사용 단계',
        answer: '요청자로 시작하는 방법:\n\n[1단계] 회원가입\n• 이메일/비밀번호 입력\n• 휴대폰 본인인증\n• 사업체 정보 입력\n\n[2단계] 서류 제출\n• 사업자등록증 제출\n• 선명하게 촬영\n\n[3단계] 승인 대기\n• 관리자 검토 (1-2영업일)\n• 승인 완료 시 푸시 알림\n\n[4단계] 오더 등록\n• 배송 조건 입력\n• 계약금(20%) 결제\n\n[5단계] 헬퍼 선택\n• 지원자 중 1명 선택\n• 자동 매칭 완료\n\n[6단계] 업무 관리\n• QR로 출근 체크\n• 마감 확인 및 잔금 결제',
      },
      {
        question: '사업체 인증하기',
        answer: '사업체 인증 절차:\n\n[필수 서류]\n• 사업자등록증\n  - 법인 또는 개인사업자\n  - 최신 발급본 권장\n\n[제출 방법]\n나의정보 > 서류 제출\n1. "사업자등록증" 선택\n2. 촬영 또는 갤러리에서 선택\n3. 업로드 완료\n\n[주의사항]\n• 서류가 선명하게 보여야 함\n• 사업자번호, 대표자명 확인\n• 휴/폐업 상태가 아니어야 함\n\n[승인 후]\n• 오더 등록 가능\n• 헬퍼 매칭 가능',
      },
      {
        question: '결제 정보 등록하기',
        answer: '결제 수단 등록:\n\n[등록 방법]\n나의정보 > 결제 정보\n\n[카드 결제]\n1. "카드 추가" 선택\n2. 카드 정보 입력\n3. 본인 인증\n4. 등록 완료\n\n[계좌이체]\n• 가상계좌 발급\n• 입금 확인 후 결제 처리\n\n[세금계산서]\n• 사업자 정보 등록\n• 월말 일괄 발행\n\n[환불 계좌]\n• 환불 시 사용할 계좌 등록\n• 본인/법인 명의 계좌',
      },
    ],
  },
  {
    id: 'orders',
    title: '오더 등록',
    icon: 'clipboard-outline',
    items: [
      {
        question: '오더 등록하기',
        answer: '새 오더를 등록하는 방법:\n\n[오더 등록 화면]\n홈 화면 > "오더 등록" 버튼\n또는 오더등록 탭 > "+" 버튼\n\n[필수 입력 정보]\n1. 택배사 선택\n2. 작업 일자 및 시간\n3. 배송 지역 (픽업 주소)\n4. 예상 물량 (박스 수)\n5. 단가 (박스당 금액)\n6. 필요 차량 종류\n\n[선택 입력]\n• 긴급 여부\n• 상세 주소\n• 특이사항/요청사항\n\n[등록 완료]\n→ 계약금 결제 화면으로 이동',
      },
      {
        question: '계약금 결제하기',
        answer: '계약금 결제 안내:\n\n[계약금이란?]\n• 총 금액의 20%\n• 오더 공개를 위한 선결제\n• 헬퍼 지원 가능 조건\n\n[계약금 계산]\n예상 물량 × 단가 = 공급가액\n공급가액 × 1.1 = 총액 (부가세 포함)\n총액 × 20% = 계약금\n\n[결제 방법]\n1. 오더 등록 완료 후\n2. 결제 화면 자동 이동\n3. 결제 수단 선택\n4. 결제 완료\n\n[결제 후]\n• 오더가 헬퍼에게 공개됨\n• 헬퍼들이 지원 시작\n• 상태: "계약금결제완료"',
      },
      {
        question: '금액 계산 방법',
        answer: '오더 금액 계산:\n\n[기본 계산]\n공급가액 = 박스 수 × 단가\n부가세 = 공급가액 × 10%\n총액 = 공급가액 + 부가세\n\n[예시]\n• 100박스 × 1,200원 = 120,000원 (공급가액)\n• 120,000원 × 10% = 12,000원 (부가세)\n• 120,000원 + 12,000원 = 132,000원 (총액)\n\n[계약금/잔금]\n• 계약금: 132,000원 × 20% = 26,400원\n• 잔금: 132,000원 × 80% = 105,600원\n\n[정산 시]\n• 실제 배송 박스 수로 재계산\n• 차액 정산 또는 환불',
      },
      {
        question: '오더 수정/취소하기',
        answer: '오더 수정 및 취소:\n\n[수정 가능 시점]\n• 헬퍼 선택 전까지\n• 오더 상세 > "수정" 버튼\n\n[수정 가능 항목]\n• 작업 일자/시간\n• 예상 물량\n• 단가\n• 특이사항\n\n[취소]\n• 헬퍼 선택 전: 전액 환불\n• 헬퍼 선택 후: 환불 불가\n\n[환불 정책]\n• 헬퍼 선택 전 취소: 계약금 100% 환불\n• 헬퍼 선택 후 취소: 환불 불가 (0%)\n  → 사유: 헬퍼가 다른 오더를 포기하고 해당 오더에 배정되었기 때문에, 취소 시 헬퍼에게 손해가 발생합니다.\n• 업무 시작 후: 환불 불가 (협의 필요)\n\n[환불 처리]\n• 결제 수단으로 3-5영업일 내 환불',
      },
      {
        question: '긴급 오더란?',
        answer: '긴급 오더 안내:\n\n[긴급 오더란?]\n• 당일 또는 익일 배송 필요한 경우\n• 할증 단가가 적용됨\n• 우선 노출로 빠른 매칭\n\n[할증률]\n• 관리자 설정에 따라 다름\n• 보통 10~20% 할증\n\n[등록 방법]\n오더 등록 시 "긴급" 옵션 체크\n→ 할증 적용된 단가 확인\n→ 계약금 결제\n\n[주의]\n• 긴급 오더도 지원자가 없을 수 있음\n• 단가를 높이면 매칭 확률 상승',
      },
    ],
  },
  {
    id: 'matching',
    title: '헬퍼 선택',
    icon: 'account-plus-outline',
    items: [
      {
        question: '지원자 확인하기',
        answer: '헬퍼 지원 확인:\n\n[확인 방법]\n1. 오더등록 탭에서 해당 오더 선택\n2. "지원자 목록" 확인\n3. 최대 3명의 지원자 표시\n\n[지원자 정보]\n• 이름 및 프로필\n• 활동 지역\n• 차량 정보\n• 평점 (별점)\n• 완료한 오더 수\n• 최근 리뷰\n\n[비교 포인트]\n• 해당 지역 경험\n• 해당 택배사 경험\n• 평점 및 리뷰 내용',
      },
      {
        question: '헬퍼 선택하기',
        answer: '헬퍼를 선택하는 방법:\n\n[선택 절차]\n1. 지원자 목록에서 헬퍼 선택\n2. 상세 정보 확인\n3. "선택" 버튼 터치\n4. 확인 후 매칭 완료!\n\n[선택 후]\n• 선택된 헬퍼에게 알림 발송\n• 다른 지원자들은 자동 거절됨\n• 오더 상태: "매칭완료"\n\n[연락하기]\n• 매칭 후 헬퍼 연락처 확인 가능\n• 업무 관련 사항 직접 연락 가능',
      },
      {
        question: '지원자가 없는 경우',
        answer: '지원자가 없을 때:\n\n[확인사항]\n• 단가가 적절한지\n• 지역이 너무 외진 곳인지\n• 일정이 급한지\n\n[해결방법]\n1. 단가 올리기\n   - 오더 수정에서 단가 상향\n\n2. 조건 완화\n   - 차량 종류 범위 확대\n   - 시간 유연하게 조정\n\n3. 긴급 오더로 전환\n   - 우선 노출\n   - 할증 적용\n\n[오더 만료]\n• 7일간 지원자 없으면 자동 만료\n• 계약금 환불 처리\n• 오더 재등록 가능',
      },
    ],
  },
  {
    id: 'checkin',
    title: 'QR 체크인',
    icon: 'qrcode',
    items: [
      {
        question: 'QR 코드 보여주기',
        answer: '헬퍼 출근 체크 방법:\n\n[내 QR 코드]\n나의정보 > 내 QR 코드\n\n[사용 방법]\n1. 헬퍼가 출근하면\n2. 내 QR 코드 화면 열기\n3. 헬퍼에게 QR 보여주기\n4. 헬퍼가 스캔하면 체크인 완료!\n\n[체크인 완료 후]\n• 오더 상태가 "업무중"으로 변경\n• 푸시 알림으로 체크인 확인\n\n[코드 직접 전달]\n• QR 스캔이 어려운 경우\n• 화면의 12자리 코드를 알려주세요\n• 헬퍼가 직접 입력',
      },
      {
        question: 'QR 코드를 분실한 경우',
        answer: 'QR 코드 관련 안내:\n\n[QR 코드는 분실되지 않습니다]\n• 앱에서 언제든 확인 가능\n• 나의정보 > 내 QR 코드\n\n[화면이 안 보이는 경우]\n• 앱을 완전히 종료 후 재시작\n• 로그아웃 후 다시 로그인\n\n[코드가 작동 안 하는 경우]\n• 화면 밝기 최대로\n• 헬퍼 앱 재시작\n• 코드 직접 입력 시도\n• 고객센터 문의',
      },
    ],
  },
  {
    id: 'closing',
    title: '마감 확인',
    icon: 'check-all',
    items: [
      {
        question: '마감 내역 확인하기',
        answer: '헬퍼가 제출한 마감 확인:\n\n[확인 방법]\n마감확인 탭 > 해당 오더 선택\n\n[마감 내역]\n• 배송 건수\n• 반품 건수\n• 배송 이력 이미지\n• 기타 첨부 이미지\n• 제출 일시\n\n[금액 계산]\n• 실제 배송 박스 수 기준\n• 최종 금액 = 박스 수 × 단가\n• 부가세 포함 표시',
      },
      {
        question: '마감 승인하기',
        answer: '마감을 승인하는 방법:\n\n[승인 절차]\n1. 마감확인 탭에서 오더 선택\n2. 제출 내역 검토\n3. "승인" 버튼 터치\n4. 승인 완료!\n\n[승인 후]\n• 잔금 결제 화면으로 이동\n• 잔금 = 최종 총액 - 계약금\n• 결제 완료 시 헬퍼에게 정산\n\n[주의사항]\n• 승인 전 내역을 꼼꼼히 확인\n• 승인 후에는 취소 어려움',
      },
      {
        question: '마감 반려하기',
        answer: '마감을 반려하는 방법:\n\n[반려 사유]\n• 배송 건수 불일치\n• 이미지가 불분명함\n• 반품 수량 오류\n• 기타 수정 필요\n\n[반려 절차]\n1. 마감확인 탭에서 오더 선택\n2. "반려" 버튼 터치\n3. 반려 사유 입력 (필수)\n4. 반려 완료\n\n[반려 후]\n• 헬퍼에게 푸시 알림\n• 헬퍼가 수정 후 재제출\n• 다시 검토 및 승인/반려',
      },
      {
        question: '잔금 결제하기',
        answer: '잔금 결제 안내:\n\n[잔금이란?]\n• 마감 승인 후 결제하는 나머지 금액\n• 총액의 80% (또는 총액 - 계약금)\n\n[잔금 계산]\n실제 배송 박스 수 × 단가 = 공급가액\n공급가액 × 1.1 = 총액\n총액 - 계약금 = 잔금\n\n[결제 방법]\n1. 마감 승인 완료 후\n2. 잔금 결제 화면 자동 이동\n3. 결제 수단 선택\n4. 결제 완료\n\n[결제 후]\n• 헬퍼에게 정산 진행\n• 오더 상태: "정산완료"',
      },
    ],
  },
  {
    id: 'payment',
    title: '결제 및 정산',
    icon: 'card-outline',
    items: [
      {
        question: '결제 내역 확인하기',
        answer: '결제 내역 확인 방법:\n\n[사용 이력]\n나의정보 > 사용 이력\n\n[확인 가능 정보]\n• 오더별 결제 내역\n• 계약금/잔금 구분\n• 결제 일시\n• 결제 수단\n• 정산 상태\n\n[상세 정보]\n오더 터치 시:\n• 공급가액, 부가세, 총액\n• 계약금/잔금 각각\n• 환불 내역 (있는 경우)',
      },
      {
        question: '환불 받기',
        answer: '환불 안내:\n\n[환불 정책]\n• 헬퍼 선택 전 취소: 100% 환불\n• 헬퍼 선택 후 취소: 환불 불가 (0%)\n  → 사유: 헬퍼가 다른 오더를 포기하고 해당 오더에 배정되었기 때문입니다.\n• 업무 시작 후: 협의 필요\n\n[환불 방법]\n• 결제 수단으로 자동 환불\n• 카드: 결제 취소 처리\n• 계좌이체: 등록 계좌로 환불\n\n[환불 소요 시간]\n• 카드: 3-5영업일\n• 계좌이체: 1-2영업일\n\n[환불 확인]\n• 사용 이력에서 환불 내역 확인\n• 푸시 알림으로 환불 완료 안내',
      },
      {
        question: '세금계산서 발행하기',
        answer: '세금계산서 발행 안내:\n\n[발행 조건]\n• 사업자 정보 등록 완료\n• 결제 완료된 오더\n\n[사업자 정보 등록]\n나의정보 > 결제 정보\n• 사업자등록번호\n• 상호명\n• 대표자명\n• 사업장 주소\n• 담당자 이메일\n\n[발행 시기]\n• 월말 일괄 발행\n• 등록 이메일로 발송\n\n[확인 방법]\n• 이메일로 발송된 세금계산서 확인\n• 국세청 홈택스에서 조회',
      },
      {
        question: '이의제기 하기',
        answer: '정산 이의제기 방법:\n\n[이의제기 대상]\n• 정산 금액 오류\n• 화물 파손/분실\n• 기타 분쟁 사항\n\n[접수 방법]\n나의정보 > 이의제기 접수\n1. 해당 오더 선택\n2. 이의 유형 선택\n3. 상세 내용 작성\n4. 증빙 자료 첨부 (선택)\n5. 제출\n\n[처리 절차]\n• 관리자 검토 (1-3영업일)\n• 헬퍼 측 확인\n• 조정 또는 기각 결정\n• 결과 알림\n\n[이의제기 내역]\n나의정보 > 이의제기 내역에서 확인',
      },
    ],
  },
  {
    id: 'review',
    title: '리뷰',
    icon: 'star-outline',
    items: [
      {
        question: '리뷰 작성하기',
        answer: '헬퍼 리뷰 작성 방법:\n\n[작성 시점]\n• 마감 승인 및 잔금 결제 완료 후\n• 리뷰 탭 또는 사용 이력에서 작성\n\n[작성 방법]\n1. 리뷰 탭 > "리뷰 작성" 버튼\n2. 또는 사용 이력에서 오더 선택\n3. 별점 선택 (1~5점)\n4. 리뷰 내용 작성\n5. 제출\n\n[리뷰 포인트]\n• 시간 준수 여부\n• 배송 품질\n• 소통 및 태도\n• 재이용 의사',
      },
      {
        question: '리뷰가 중요한 이유',
        answer: '리뷰의 중요성:\n\n[헬퍼에게]\n• 평점이 프로필에 표시됨\n• 좋은 리뷰는 매칭 확률 상승\n• 우수 헬퍼 선정 기준\n\n[다른 요청자에게]\n• 헬퍼 선택 시 참고 자료\n• 실제 업무 경험 공유\n• 신뢰할 수 있는 정보\n\n[리뷰 작성 팁]\n• 구체적인 경험 작성\n• 장점과 개선점 균형있게\n• 다른 요청자에게 도움될 정보 포함',
      },
    ],
  },
];

export default function HelpScreen({ navigation }: HelpScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();

  const isHelper = user?.role === 'helper';
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;
  const helpSections = isHelper ? HELPER_HELP_SECTIONS : REQUESTER_HELP_SECTIONS;

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
      <Card style={styles.introCard}>
        <View style={[styles.introIcon, { backgroundColor: isHelper ? BrandColors.helperLight : BrandColors.requesterLight }]}>
          <Icon name="book-outline" size={32} color={primaryColor} />
        </View>
        <ThemedText style={[styles.introTitle, { color: theme.text }]}>
          헬프미 {isHelper ? '헬퍼' : '요청자'} 가이드
        </ThemedText>
        <ThemedText style={[styles.introSubtitle, { color: theme.tabIconDefault }]}>
          앱 사용법을 단계별로 확인하세요
        </ThemedText>
      </Card>

      {helpSections.map((section) => {
        const isSectionExpanded = expandedSections.includes(section.id);
        
        return (
          <View key={section.id} style={styles.sectionContainer}>
            <Card style={styles.sectionHeader} onPress={() => toggleSection(section.id)}>
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionIcon, { backgroundColor: isHelper ? BrandColors.helperLight : BrandColors.requesterLight }]}>
                  <Icon name={section.icon as any} size={20} color={primaryColor} />
                </View>
                <View>
                  <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                    {section.title}
                  </ThemedText>
                  <ThemedText style={[styles.sectionCount, { color: theme.tabIconDefault }]}>
                    {section.items.length}개 항목
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
                          {item.question}
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

      <Card style={styles.contactCard}>
        <ThemedText style={[styles.contactTitle, { color: theme.text }]}>
          더 궁금한 점이 있으신가요?
        </ThemedText>
        <Pressable 
          style={[styles.contactButton, { backgroundColor: primaryColor }]}
          onPress={() => navigation.navigate('Support')}
        >
          <Icon name="chatbox-outline" size={18} color="#FFFFFF" />
          <ThemedText style={styles.contactButtonText}>자주 묻는 질문 보기</ThemedText>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  introCard: {
    padding: Spacing['2xl'],
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
    padding: Spacing.lg,
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
    padding: Spacing['2xl'],
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  contactTitle: {
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  contactButtonText: {
    ...Typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
