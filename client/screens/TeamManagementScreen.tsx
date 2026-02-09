import React, { useState } from "react";
import { View, StyleSheet, Alert, Pressable, RefreshControl, ActivityIndicator, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface TeamMember {
  id: number;
  helperId: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    phone: string;
    email: string;
  };
}

interface Team {
  id: number;
  name: string;
  leaderId: string;
  qrCodeToken: string;
  businessType?: string;
  emergencyPhone?: string;
  commissionRate: number;
  isActive: boolean;
  members?: TeamMember[];
  leader?: {
    id: string;
    name: string;
    phone: string;
  };
}

interface TeamResponse {
  isLeader: boolean;
  team: Team | null;
  membership?: {
    id: number;
    joinedAt: string;
  };
}

export default function TeamManagementScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const primaryColor = BrandColors.helper;
  
  const borderColor = isDark ? '#4B5563' : '#E5E7EB';
  const inputBgColor = isDark ? '#1F2937' : '#F9FAFB';
  
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [permission, requestPermission] = useCameraPermissions();

  const { data: teamData, isLoading, refetch } = useQuery<TeamResponse>({
    queryKey: ["/api/teams/my-team"],
  });

  const joinTeamMutation = useMutation({
    mutationFn: async (qrToken: string) => {
      const res = await apiRequest("POST", "/api/teams/join", { qrToken });
      return res.json();
    },
    onSuccess: () => {
      Alert.alert("성공", "팀에 가입되었습니다");
      queryClient.invalidateQueries({ queryKey: ["/api/teams/my-team"] });
      setShowQrScanner(false);
      setManualToken("");
    },
    onError: (error: Error) => {
      Alert.alert("오류", error.message || "팀 가입에 실패했습니다");
    },
  });

  const leaveTeamMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/teams/leave", {});
      return res.json();
    },
    onSuccess: () => {
      Alert.alert("완료", "팀에서 탈퇴했습니다");
      queryClient.invalidateQueries({ queryKey: ["/api/teams/my-team"] });
    },
    onError: (error: Error) => {
      Alert.alert("오류", error.message || "팀 탈퇴에 실패했습니다");
    },
  });

  const handleBarCodeScanned = (data: string) => {
    if (data && !joinTeamMutation.isPending) {
      joinTeamMutation.mutate(data);
    }
  };

  const handleJoinWithToken = () => {
    if (!manualToken.trim()) {
      Alert.alert("오류", "팀 코드를 입력해주세요");
      return;
    }
    joinTeamMutation.mutate(manualToken.trim());
  };

  const handleLeaveTeam = () => {
    Alert.alert(
      "팀 탈퇴",
      "정말로 팀에서 탈퇴하시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        { text: "탈퇴", style: "destructive", onPress: () => leaveTeamMutation.mutate() },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  if (showQrScanner) {
    if (!permission?.granted) {
      return (
        <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight + Spacing.xl }]}>
          <Card variant="glass" padding="lg" style={styles.permissionCard}>
            <Icon name="camera-outline" size={48} color={primaryColor} />
            <ThemedText style={[styles.permissionText, { color: theme.text }]}>
              QR 코드를 스캔하려면 카메라 권한이 필요합니다
            </ThemedText>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: primaryColor }]}
              onPress={requestPermission}
            >
              <ThemedText style={styles.buttonText}>카메라 권한 허용</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { borderColor }]}
              onPress={() => setShowQrScanner(false)}
            >
              <ThemedText style={{ color: theme.text }}>취소</ThemedText>
            </Pressable>
          </Card>
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => handleBarCodeScanned(data)}
          />
          <View style={styles.scannerOverlay}>
            <View style={[styles.scannerFrame, { borderColor: primaryColor }]} />
            <ThemedText style={styles.scannerText}>팀 QR 코드를 스캔하세요</ThemedText>
          </View>
        </View>
        <View style={[styles.manualInputContainer, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.manualInputLabel, { color: theme.tabIconDefault }]}>
            또는 팀 코드 직접 입력
          </ThemedText>
          <View style={styles.manualInputRow}>
            <TextInput
              style={[styles.tokenInput, { backgroundColor: inputBgColor, color: theme.text, borderColor }]}
              value={manualToken}
              onChangeText={setManualToken}
              placeholder="팀 코드 입력"
              placeholderTextColor={theme.tabIconDefault}
            />
            <Pressable
              style={[styles.joinButton, { backgroundColor: primaryColor }]}
              onPress={handleJoinWithToken}
              disabled={joinTeamMutation.isPending}
            >
              {joinTeamMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>가입</ThemedText>
              )}
            </Pressable>
          </View>
          <Pressable
            style={[styles.cancelButton, { borderColor }]}
            onPress={() => setShowQrScanner(false)}
          >
            <ThemedText style={{ color: theme.text }}>취소</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!teamData?.team) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor={primaryColor} />
        }
      >
        <Card variant="glass" padding="xl" style={styles.noTeamCard}>
          <View style={[styles.iconContainer, { backgroundColor: BrandColors.helperLight }]}>
            <Icon name="people-outline" size={32} color={primaryColor} />
          </View>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            팀에 소속되어 있지 않습니다
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
            팀장에게 받은 QR 코드를 스캔하거나{"\n"}팀 코드를 입력하여 가입하세요
          </ThemedText>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: primaryColor, marginTop: Spacing.xl }]}
            onPress={() => setShowQrScanner(true)}
          >
            <Icon name="qr-code-outline" size={20} color="#fff" />
            <ThemedText style={[styles.buttonText, { marginLeft: Spacing.sm }]}>팀 가입하기</ThemedText>
          </Pressable>
        </Card>
      </ScrollView>
    );
  }

  const { team, isLeader } = teamData;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refetch} tintColor={primaryColor} />
      }
    >
      <Card variant="glass" padding="lg" style={styles.teamCard}>
        <View style={styles.teamHeader}>
          <View style={[styles.iconContainer, { backgroundColor: BrandColors.helperLight }]}>
            <Icon name="people" size={28} color={primaryColor} />
          </View>
          <View style={styles.teamInfo}>
            <ThemedText style={[styles.teamName, { color: theme.text }]}>{team.name}</ThemedText>
            <View style={[styles.badge, { backgroundColor: isLeader ? primaryColor : theme.backgroundSecondary }]}>
              <ThemedText style={[styles.badgeText, { color: isLeader ? "#fff" : theme.text }]}>
                {isLeader ? "팀장" : "팀원"}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: borderColor }]} />

        {team.businessType ? (
          <View style={styles.infoRow}>
            <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>업무</ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>{team.businessType}</ThemedText>
          </View>
        ) : null}

        {team.emergencyPhone ? (
          <View style={styles.infoRow}>
            <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>긴급연락처</ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>{team.emergencyPhone}</ThemedText>
          </View>
        ) : null}

        {!isLeader && team.leader ? (
          <View style={styles.infoRow}>
            <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>팀장</ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>{team.leader.name}</ThemedText>
          </View>
        ) : null}
      </Card>

      {isLeader ? (
        <>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>팀원 목록</ThemedText>
            <ThemedText style={[styles.memberCount, { color: theme.tabIconDefault }]}>
              {team.members?.length || 0}명
            </ThemedText>
          </View>

          {team.members?.length === 0 ? (
            <Card variant="glass" padding="xl" style={styles.emptyCard}>
              <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
                아직 팀원이 없습니다
              </ThemedText>
            </Card>
          ) : (
            team.members?.map((member) => (
              <Card key={member.id} variant="glass" padding="md" style={styles.memberCard}>
                <View style={styles.memberCardContent}>
                  <View style={[styles.memberAvatar, { backgroundColor: BrandColors.helperLight }]}>
                    <ThemedText style={[styles.avatarText, { color: primaryColor }]}>
                      {member.user?.name?.[0] || "?"}
                    </ThemedText>
                  </View>
                  <View style={styles.memberInfo}>
                    <ThemedText style={[styles.memberName, { color: theme.text }]}>
                      {member.user?.name || "알 수 없음"}
                    </ThemedText>
                    <ThemedText style={[styles.memberPhone, { color: theme.tabIconDefault }]}>
                      {member.user?.phone || "-"}
                    </ThemedText>
                  </View>
                </View>
              </Card>
            ))
          )}

          <Card variant="glass" padding="lg" style={styles.qrCard}>
            <ThemedText style={[styles.qrLabel, { color: theme.tabIconDefault }]}>
              팀 초대 코드
            </ThemedText>
            <View style={[styles.qrCodeBox, { backgroundColor: inputBgColor, borderColor }]}>
              <ThemedText style={[styles.qrCodeText, { color: theme.text }]} selectable>
                {team.qrCodeToken}
              </ThemedText>
            </View>
            <ThemedText style={[styles.qrHint, { color: theme.tabIconDefault }]}>
              이 코드를 팀원에게 공유하세요
            </ThemedText>
          </Card>
        </>
      ) : null}

      {!isLeader ? (
        <Pressable
          style={[styles.leaveButton, { borderColor: "#dc3545" }]}
          onPress={handleLeaveTeam}
          disabled={leaveTeamMutation.isPending}
        >
          {leaveTeamMutation.isPending ? (
            <ActivityIndicator size="small" color="#dc3545" />
          ) : (
            <>
              <Icon name="exit-outline" size={20} color="#dc3545" />
              <ThemedText style={[styles.leaveButtonText, { color: "#dc3545", marginLeft: Spacing.sm }]}>
                팀 탈퇴
              </ThemedText>
            </>
          )}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noTeamCard: {
    padding: Spacing["3xl"],
    alignItems: "center",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 22,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    width: "100%",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
    width: "100%",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  teamCard: {
    padding: Spacing.xl,
  },
  teamHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  teamInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  teamName: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: Spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  label: {
    ...Typography.body,
  },
  value: {
    fontSize: 16,
    fontWeight: "600",
  },
  membersCard: {
    padding: Spacing.xl,
    marginTop: Spacing.lg,
  },
  memberCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  memberCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  emptyCard: {
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  qrCard: {
    padding: Spacing.xl,
    marginTop: Spacing.md,
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
  },
  memberCount: {
    ...Typography.body,
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
    paddingVertical: Spacing.lg,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "600",
  },
  memberInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
  },
  memberPhone: {
    ...Typography.small,
  },
  qrSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    alignItems: "center",
  },
  qrLabel: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  qrCodeBox: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    width: "100%",
  },
  qrCodeText: {
    fontSize: 12,
    textAlign: "center",
    fontFamily: "monospace",
  },
  qrHint: {
    ...Typography.small,
    marginTop: Spacing.sm,
  },
  leaveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.xl,
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  permissionCard: {
    padding: Spacing["3xl"],
    alignItems: "center",
    marginHorizontal: Spacing.lg,
  },
  permissionText: {
    ...Typography.body,
    textAlign: "center",
    marginVertical: Spacing.lg,
  },
  scannerContainer: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderRadius: BorderRadius.lg,
  },
  scannerText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: Spacing.xl,
  },
  manualInputContainer: {
    padding: Spacing.xl,
  },
  manualInputLabel: {
    ...Typography.small,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  manualInputRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  tokenInput: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  joinButton: {
    height: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
});
