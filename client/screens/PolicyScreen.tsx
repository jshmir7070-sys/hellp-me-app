import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography } from "@/constants/theme";

type PolicyScreenProps = NativeStackScreenProps<any, 'Policy'>;

const TERMS_OF_SERVICE = `헬프미 서비스 이용약관

제1조 (목적)
본 약관은 헬프미(이하 "회사")가 제공하는 배송 매칭 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (용어의 정의)
1. "서비스"란 회사가 제공하는 배송 매칭 플랫폼을 의미합니다.
2. "이용자"란 본 약관에 따라 서비스를 이용하는 회원을 말합니다.
3. "헬퍼"란 배송 서비스를 제공하는 이용자를 의미합니다.
4. "요청자"란 배송 서비스를 요청하는 이용자를 의미합니다.

제3조 (약관의 효력 및 변경)
1. 본 약관은 서비스를 이용하고자 하는 모든 이용자에게 적용됩니다.
2. 회사는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지사항을 통해 공지합니다.

제4조 (서비스의 제공)
1. 회사는 다음의 서비스를 제공합니다:
   - 배송 요청 및 수락 매칭
   - 계약서 작성 및 관리
   - 결제 및 정산 서비스
   - QR 코드를 통한 출퇴근 관리

제5조 (이용자의 의무)
1. 이용자는 관계 법령 및 본 약관의 규정을 준수해야 합니다.
2. 이용자는 타인의 개인정보를 침해하거나 서비스를 부정하게 이용해서는 안 됩니다.
3. 헬퍼는 약속된 배송 서비스를 성실히 수행해야 합니다.

제6조 (계약 및 결제)
1. 서비스 이용에 따른 계약은 전자서명을 통해 체결됩니다.
2. 결제는 회사가 지정한 결제 수단을 통해 이루어집니다.
3. 정산은 월 단위로 진행되며, 세부 내역은 앱 내에서 확인할 수 있습니다.

제7조 (면책조항)
1. 회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력으로 인해 서비스를 제공할 수 없는 경우 책임이 면제됩니다.
2. 이용자 간의 분쟁에 대해 회사는 중재 역할만 수행하며, 직접적인 책임을 지지 않습니다.

제8조 (분쟁 해결)
본 약관과 관련된 분쟁은 대한민국 법률에 따라 해결되며, 관할 법원은 회사 소재지의 법원으로 합니다.

부칙
본 약관은 2024년 1월 1일부터 시행됩니다.`;

const PRIVACY_POLICY = `헬프미 개인정보 처리방침

1. 개인정보의 처리 목적
헬프미(이하 "회사")는 다음의 목적을 위해 개인정보를 처리합니다:
- 회원 가입 및 관리
- 서비스 제공 및 계약 이행
- 결제 및 정산 처리
- 고객 상담 및 불만 처리

2. 수집하는 개인정보 항목
회사는 다음의 개인정보를 수집합니다:
- 필수항목: 이름, 이메일, 휴대폰 번호, 비밀번호
- 헬퍼 추가항목: 차량 정보, 은행 계좌 정보, 신분증 사본
- 요청자 추가항목: 사업자 등록증, 담당자 정보

3. 개인정보의 보유 및 이용 기간
- 회원 탈퇴 시까지 (단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관)
- 전자상거래법에 따른 거래 기록: 5년
- 통신비밀보호법에 따른 통신사실확인자료: 12개월

4. 개인정보의 제3자 제공
회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다:
- 이용자가 사전에 동의한 경우
- 법령에 의해 요구되는 경우
- 서비스 제공을 위해 필요한 경우 (결제 대행사 등)

5. 개인정보의 안전성 확보 조치
회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취합니다:
- 개인정보 암호화
- 해킹 등에 대비한 기술적 대책
- 개인정보 접근 제한
- 정기적인 자체 감사

6. 개인정보 보호책임자
- 성명: 홍길동
- 직책: 개인정보보호팀장
- 연락처: privacy@hellpme.com

7. 정보주체의 권리
이용자는 언제든지 다음의 권리를 행사할 수 있습니다:
- 개인정보 열람 요구
- 오류 정정 요구
- 삭제 요구
- 처리 정지 요구

8. 개인정보 처리방침 변경
본 방침은 시행일로부터 적용되며, 변경 시 앱 내 공지사항을 통해 고지합니다.

시행일: 2024년 1월 1일`;

export default function PolicyScreen({ route }: PolicyScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const policyType = route.params?.type as 'terms' | 'privacy';
  const content = policyType === 'terms' ? TERMS_OF_SERVICE : PRIVACY_POLICY;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        <ThemedText style={[styles.content, { color: theme.text }]}>
          {content}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    ...Typography.body,
    lineHeight: 24,
  },
});
