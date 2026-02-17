import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button } from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useSystemNotification } from '@/components/notifications';
import { Spacing } from '@/constants/theme';

/**
 * 시스템 알림 메시지 데모 화면
 * 
 * 이 컴포넌트는 새로운 SystemAlert와 SystemToast의 사용 예제를 보여줍니다.
 * 실제 앱에서는 이 패턴을 따라 알림을 구현하세요.
 */
export function SystemNotificationDemo() {
    const { alert, toast } = useSystemNotification();

    return (
        <ScrollView style={styles.container}>
            <View style={styles.section}>
                <ThemedText type="h2" style={styles.sectionTitle}>
                    Alert (모달) 예제
                </ThemedText>
                <ThemedText type="body" style={styles.description}>
                    중요한 메시지나 사용자 확인이 필요한 경우 사용
                </ThemedText>

                <View style={styles.buttonGroup}>
                    <Button
                        onPress={() => alert.info('정보 안내', '새로운 업데이트가 있습니다.')}
                        variant="outline"
                    >
                        정보 (파란색)
                    </Button>

                    <Button
                        onPress={() =>
                            alert.success('완료', '주문이 성공적으로 등록되었습니다.')
                        }
                        variant="outline"
                    >
                        성공 (초록색)
                    </Button>

                    <Button
                        onPress={() =>
                            alert.warning('주의', '이 작업은 되돌릴 수 없습니다.')
                        }
                        variant="outline"
                    >
                        경고 (노란색)
                    </Button>

                    <Button
                        onPress={() =>
                            alert.error('오류', '서버 연결에 실패했습니다.')
                        }
                        variant="outline"
                    >
                        오류 (빨간색)
                    </Button>
                </View>
            </View>

            <View style={styles.section}>
                <ThemedText type="h2" style={styles.sectionTitle}>
                    버튼 스타일 예제
                </ThemedText>

                <View style={styles.buttonGroup}>
                    <Button
                        onPress={() =>
                            alert.warning('계정 삭제', '정말로 계정을 삭제하시겠습니까?', [
                                {
                                    text: '삭제',
                                    style: 'destructive',
                                    onPress: () => toast.success('계정이 삭제되었습니다'),
                                },
                                { text: '취소', style: 'secondary' },
                            ])
                        }
                        variant="outline"
                    >
                        삭제 확인 (Destructive)
                    </Button>

                    <Button
                        onPress={() =>
                            alert.info('로그아웃', '로그아웃 하시겠습니까?', [
                                {
                                    text: '로그아웃',
                                    style: 'primary',
                                    onPress: () => toast.info('로그아웃 되었습니다'),
                                },
                                { text: '취소', style: 'secondary' },
                            ])
                        }
                        variant="outline"
                    >
                        로그아웃 (Primary + Secondary)
                    </Button>
                </View>
            </View>

            <View style={styles.section}>
                <ThemedText type="h2" style={styles.sectionTitle}>
                    Toast (알림 바) 예제
                </ThemedText>
                <ThemedText type="body" style={styles.description}>
                    간단한 피드백이나 상태 알림에 사용 (자동 닫힘)
                </ThemedText>

                <View style={styles.buttonGroup}>
                    <Button
                        onPress={() => toast.info('새로운 메시지가 도착했습니다')}
                        variant="outline"
                    >
                        정보 토스트
                    </Button>

                    <Button
                        onPress={() => toast.success('파일 업로드 완료', '성공')}
                        variant="outline"
                    >
                        성공 토스트
                    </Button>

                    <Button
                        onPress={() => toast.warning('배터리가 부족합니다', '경고')}
                        variant="outline"
                    >
                        경고 토스트
                    </Button>

                    <Button
                        onPress={() => toast.error('로그인에 실패했습니다', '오류')}
                        variant="outline"
                    >
                        오류 토스트
                    </Button>
                </View>
            </View>

            <View style={styles.section}>
                <ThemedText type="h2" style={styles.sectionTitle}>
                    실제 사용 시나리오
                </ThemedText>

                <View style={styles.buttonGroup}>
                    <Button
                        onPress={() => {
                            // 로그인 실패 시나리오
                            alert.error(
                                '로그인 실패',
                                '이메일 또는 비밀번호를 확인해주세요.',
                                [
                                    {
                                        text: '비밀번호 찾기',
                                        style: 'primary',
                                        onPress: () => toast.info('비밀번호 찾기 화면으로 이동'),
                                    },
                                    { text: '확인', style: 'secondary' },
                                ]
                            );
                        }}
                        variant="outline"
                    >
                        로그인 실패
                    </Button>

                    <Button
                        onPress={() => {
                            // 주문 확인 시나리오
                            alert.warning(
                                '주문 확인',
                                '총 금액 50,000원을 결제하시겠습니까?',
                                [
                                    {
                                        text: '결제하기',
                                        style: 'primary',
                                        onPress: () => {
                                            toast.info('결제 처리 중...', '진행 중');
                                            setTimeout(() => {
                                                toast.success('결제가 완료되었습니다', '성공');
                                            }, 2000);
                                        },
                                    },
                                    { text: '취소', style: 'secondary' },
                                ]
                            );
                        }}
                        variant="outline"
                    >
                        주문 확인
                    </Button>

                    <Button
                        onPress={() => {
                            // 네트워크 오류 시나리오
                            alert.error(
                                '네트워크 오류',
                                '서버와의 연결이 끊어졌습니다. 다시 시도해주세요.',
                                [
                                    {
                                        text: '다시 시도',
                                        style: 'primary',
                                        onPress: () => toast.info('재연결 시도 중...'),
                                    },
                                    { text: '닫기', style: 'secondary' },
                                ]
                            );
                        }}
                        variant="outline"
                    >
                        네트워크 오류
                    </Button>

                    <Button
                        onPress={() => {
                            // 파일 업로드 시나리오
                            toast.info('파일 업로드 중...', '진행 중');
                            setTimeout(() => {
                                toast.success('파일 업로드 완료!', '성공');
                            }, 2000);
                        }}
                        variant="outline"
                    >
                        파일 업로드
                    </Button>
                </View>
            </View>

            <View style={styles.section}>
                <ThemedText type="h2" style={styles.sectionTitle}>
                    지속 시간 테스트
                </ThemedText>

                <View style={styles.buttonGroup}>
                    <Button
                        onPress={() => toast.info('2초 후 닫힘', '빠른 메시지', 2000)}
                        variant="outline"
                    >
                        2초 토스트
                    </Button>

                    <Button
                        onPress={() => toast.success('4초 후 닫힘 (기본)', '기본 메시지')}
                        variant="outline"
                    >
                        4초 토스트 (기본)
                    </Button>

                    <Button
                        onPress={() => toast.warning('6초 후 닫힘', '긴 메시지', 6000)}
                        variant="outline"
                    >
                        6초 토스트
                    </Button>
                </View>
            </View>

            <View style={styles.section}>
                <ThemedText type="h2" style={styles.sectionTitle}>
                    다중 토스트 테스트
                </ThemedText>

                <View style={styles.buttonGroup}>
                    <Button
                        onPress={() => {
                            toast.info('첫 번째 메시지');
                            setTimeout(() => toast.success('두 번째 메시지'), 500);
                            setTimeout(() => toast.warning('세 번째 메시지'), 1000);
                        }}
                        variant="outline"
                    >
                        여러 토스트 동시 표시
                    </Button>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: Spacing.lg,
    },
    section: {
        marginBottom: Spacing['3xl'],
    },
    sectionTitle: {
        marginBottom: Spacing.sm,
    },
    description: {
        marginBottom: Spacing.lg,
        opacity: 0.7,
    },
    buttonGroup: {
        gap: Spacing.md,
    },
});
