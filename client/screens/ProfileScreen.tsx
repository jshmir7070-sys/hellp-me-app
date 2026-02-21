import React, { useState } from "react";
import { View, Pressable, StyleSheet, Alert, Platform, ScrollView, Modal, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getToken } from '@/utils/secure-token-storage';

const AVATAR_OPTIONS = [
  { id: 'avatar:delivery', emoji: '🚚', label: '배송' },
  { id: 'avatar:package', emoji: '📦', label: '박스' },
  { id: 'avatar:worker', emoji: '👷', label: '작업자' },
  { id: 'avatar:star', emoji: '⭐', label: '스타' },
  { id: 'avatar:rocket', emoji: '🚀', label: '로켓' },
  { id: 'avatar:smile', emoji: '😊', label: '스마일' },
];

type ProfileScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  profileImage?: string;
  profileImageUrl?: string; // Add this field to match backend response
  rating?: number;
  completedJobs?: number;
  teamName?: string;
  teamId?: number;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
}

interface Team {
  id: number;
  name: string;
  memberCount: number;
  leaderId: number;
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, logout, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [showImageOptions, setShowImageOptions] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const isHelper = user?.role === 'helper';
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;

  const { data: helperProfile, refetch: refetchHelper } = useQuery<UserProfile>({
    queryKey: ['/api/helpers/profile'],
    enabled: isHelper,
  });

  const { data: requesterProfile, refetch: refetchRequester } = useQuery<UserProfile>({
    queryKey: ['/api/requesters/business'],
    enabled: !isHelper,
  });

  // 요청자는 /api/requesters/business에 프로필 이미지/이름 등이 없으므로
  // /api/auth/me에서 유저 프로필 정보를 별도로 가져옴
  const { data: authMe, refetch: refetchAuthMe } = useQuery<{ user: UserProfile }>({
    queryKey: ['/api/auth/me'],
    enabled: !isHelper,
  });

  const profile = isHelper
    ? helperProfile
    : authMe?.user
      ? { ...authMe.user, ...(requesterProfile || {}) }
      : requesterProfile;

  const { data: team } = useQuery<Team>({
    queryKey: ['/api/helper/my-team'],
    enabled: isHelper,
  });

  const handleAvatarPress = () => {
    setShowImageOptions(true);
  };

  const handlePickFromGallery = async () => {
    setShowImageOptions(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('오류', '이미지 선택에 실패했습니다');
    }
  };

  const handleTakePhoto = async () => {
    setShowImageOptions(false);

    if (Platform.OS === 'web') {
      Alert.alert('알림', '웹에서는 카메라를 사용할 수 없습니다. Expo Go 앱에서 사용해주세요.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '카메라 권한이 필요합니다');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('오류', '카메라 실행에 실패했습니다');
    }
  };

  const uploadProfileImage = async (uri: string) => {
    setIsUploadingImage(true);
    try {
      const token = await getToken();
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, 'profile.jpg');
      } else {
        const filename = uri.split('/').pop() || 'profile.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const mimeType = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
        formData.append('file', {
          uri,
          name: filename,
          type: mimeType,
        } as any);
      }

      const uploadResponse = await fetch(new URL('/api/upload/profile-image', getApiUrl()).toString(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (uploadResponse.ok) {
        await refreshUser();
        if (isHelper) {
          refetchHelper();
        } else {
          refetchAuthMe();
          refetchRequester();
        }
        Alert.alert('완료', '프로필 사진이 변경되었습니다');
      } else {
        const data = await uploadResponse.json();
        Alert.alert('오류', data.message || '업로드에 실패했습니다');
      }
    } catch (error) {
      console.error('Upload profile image error:', error);
      Alert.alert('오류', '프로필 사진 업로드에 실패했습니다');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSelectAvatar = async (avatarId: string) => {
    setShowAvatarPicker(false);
    setIsUploadingImage(true);
    try {
      const res = await apiRequest('PATCH', '/api/user/profile', {
        profileImageUrl: avatarId,
      });
      if (res.ok) {
        await refreshUser();
        if (isHelper) {
          refetchHelper();
        } else {
          refetchAuthMe();
          refetchRequester();
        }
        Alert.alert('완료', '아바타가 변경되었습니다');
      } else {
        const data = await res.json();
        Alert.alert('오류', data.message || '아바타 변경에 실패했습니다');
      }
    } catch (error) {
      console.error('Avatar selection error:', error);
      Alert.alert('오류', '아바타 변경에 실패했습니다');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      logout();
    } else {
      Alert.alert(
        '로그아웃',
        '정말 로그아웃 하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '로그아웃', style: 'destructive', onPress: logout },
        ]
      );
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Card style={styles.profileCard}>
        <Pressable
          onPress={handleAvatarPress}
          disabled={isUploadingImage}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.avatarWrapper}>
            {isUploadingImage ? (
              <View style={[styles.avatarContainer, { backgroundColor: primaryColor + '20' }]}>
                <ActivityIndicator size="large" color={primaryColor} />
              </View>
            ) : (
              <Avatar
                uri={(profile?.profileImageUrl || profile?.profileImage) ?
                  ((profile?.profileImageUrl || profile?.profileImage)?.startsWith('avatar:') ?
                    (profile?.profileImageUrl || profile?.profileImage) :
                    (profile?.profileImageUrl || profile?.profileImage)?.startsWith('http') ?
                      (profile?.profileImageUrl || profile?.profileImage) :
                      `${getApiUrl()}${profile?.profileImageUrl || profile?.profileImage}`)
                  : undefined}
                size={80}
                isHelper={isHelper}
                style={styles.avatarContainer}
              />
            )}
          </View>
        </Pressable>
        <ThemedText style={[styles.userName, { color: theme.text }]}>
          {profile?.name || user?.name || '사용자'}
        </ThemedText>
        <View style={[styles.roleBadge, { backgroundColor: isHelper ? BrandColors.helperLight : BrandColors.requesterLight }]}>
          <ThemedText style={[styles.roleBadgeText, { color: primaryColor }]}>
            {isHelper ? '헬퍼' : '요청자'}
          </ThemedText>
        </View>
        <ThemedText style={[styles.userEmail, { color: theme.tabIconDefault }]}>
          {profile?.email || user?.email}
        </ThemedText>
        {profile?.phone ? (
          <ThemedText style={[styles.userPhone, { color: theme.tabIconDefault }]}>
            {profile.phone}
          </ThemedText>
        ) : null}

        {isHelper && (profile?.rating !== undefined || profile?.completedJobs !== undefined) ? (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {profile?.rating?.toFixed(1) || '-'}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.tabIconDefault }]}>평점</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {profile?.completedJobs || 0}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.tabIconDefault }]}>완료</ThemedText>
            </View>
          </View>
        ) : null}

      </Card>

      {isHelper ? (
        <>
          <View style={styles.menuSection}>
            <ThemedText style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>서류 관리</ThemedText>

            <MenuItem
              icon="document-text-outline"
              label="서류 제출"
              description="사업자등록증, 운전면허증, 차량등록증"
              theme={theme}
              onPress={() => navigation.navigate('DocumentsMenu')}
            />
          </View>

          <View style={styles.menuSection}>
            <ThemedText style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>QR 체크인</ThemedText>

            <MenuItem
              icon="camera-outline"
              label="요청자 QR 스캔"
              description="요청자의 QR을 스캔하여 출근 기록"
              theme={theme}
              onPress={() => navigation.navigate('QRCheckin')}
            />
          </View>

          <View style={styles.menuSection}>
            <ThemedText style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>팀 관리</ThemedText>

            {team ? (
              <Card style={styles.teamCard}>
                <View style={styles.teamInfo}>
                  <View style={[styles.teamIcon, { backgroundColor: BrandColors.helperLight }]}>
                    <Icon name="people-outline" size={20} color={primaryColor} />
                  </View>
                  <View style={styles.teamDetails}>
                    <ThemedText style={[styles.teamName, { color: theme.text }]}>{team.name}</ThemedText>
                    <ThemedText style={[styles.teamMemberCount, { color: theme.tabIconDefault }]}>
                      {team.memberCount}명의 멤버
                    </ThemedText>
                  </View>
                </View>
                <Pressable
                  style={styles.teamAction}
                  onPress={() => navigation.navigate('TeamManagement')}
                >
                  <ThemedText style={[styles.teamActionText, { color: primaryColor }]}>관리</ThemedText>
                  <Icon name="chevron-forward-outline" size={16} color={primaryColor} />
                </Pressable>
              </Card>
            ) : (
              <MenuItem
                icon="people-outline"
                label="팀 가입하기"
                description="팀 코드를 입력하여 팀에 가입하세요"
                theme={theme}
                onPress={() => navigation.navigate('CreateTeam')}
              />
            )}
          </View>

        </>
      ) : (
        <>
          <View style={styles.menuSection}>
            <ThemedText style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>협력업체</ThemedText>

            <MenuItem
              icon="storefront-outline"
              label="협력업체 등록"
              description="사업자정보, 결제수단, 환불계좌 관리"
              theme={theme}
              badge={!(requesterProfile as any)?.businessNumber ? '미등록' : undefined}
              badgeColor="#EF4444"
              onPress={() => navigation.navigate('PartnerRegistration')}
            />
          </View>

          <View style={styles.menuSection}>
            <ThemedText style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>QR 체크인</ThemedText>

            <MenuItem
              icon="grid-outline"
              label="내 QR 보기"
              description="헬퍼 출근 확인용 QR 코드"
              theme={theme}
              onPress={() => navigation.navigate('QRCheckin')}
            />
          </View>

        </>
      )}

      <View style={styles.menuSection}>
        <ThemedText style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>설정</ThemedText>

        <MenuItem
          icon="settings-outline"
          label="앱 설정"
          theme={theme}
          onPress={() => navigation.navigate('Settings')}
        />
      </View>

      <View style={styles.menuSection}>
        <ThemedText style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>지원</ThemedText>

        <MenuItem
          icon="help-circle-outline"
          label="사용 가이드"
          description="앱 사용법 안내"
          theme={theme}
          onPress={() => navigation.navigate('Help')}
        />
        <MenuItem
          icon="help-circle-outline"
          label="자주 묻는 질문"
          description="FAQ"
          theme={theme}
          onPress={() => navigation.navigate('Support')}
        />
        <MenuItem
          icon="document-text-outline"
          label="이용약관"
          theme={theme}
          onPress={() => navigation.navigate('Policy', { type: 'terms' })}
        />
        <MenuItem
          icon="shield-outline"
          label="개인정보 처리방침"
          theme={theme}
          onPress={() => navigation.navigate('Policy', { type: 'privacy' })}
        />
      </View>

      <Pressable
        testID="button-logout"
        style={({ pressed }) => [
          styles.logoutButton,
          { opacity: pressed ? 0.7 : 1 },
        ]}
        onPress={handleLogout}
      >
        <Icon name="log-out-outline" size={20} color={BrandColors.error} />
        <ThemedText style={styles.logoutText}>로그아웃</ThemedText>
      </Pressable>

      <ThemedText style={[styles.versionText, { color: theme.tabIconDefault }]}>
        버전 1.0.0
      </ThemedText>

      <Modal
        visible={showImageOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageOptions(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowImageOptions(false)}
        >
          <View style={[styles.actionSheet, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.actionSheetTitle, { color: theme.text }]}>
              프로필 사진 변경
            </ThemedText>

            <Pressable
              style={({ pressed }) => [
                styles.actionSheetOption,
                { backgroundColor: pressed ? theme.backgroundRoot : 'transparent' }
              ]}
              onPress={handlePickFromGallery}
            >
              <Icon name="images-outline" size={24} color={primaryColor} />
              <ThemedText style={[styles.actionSheetOptionText, { color: theme.text }]}>
                갤러리에서 선택
              </ThemedText>
            </Pressable>

            {Platform.OS !== 'web' ? (
              <Pressable
                style={({ pressed }) => [
                  styles.actionSheetOption,
                  { backgroundColor: pressed ? theme.backgroundRoot : 'transparent' }
                ]}
                onPress={handleTakePhoto}
              >
                <Icon name="camera-outline" size={24} color={primaryColor} />
                <ThemedText style={[styles.actionSheetOptionText, { color: theme.text }]}>
                  카메라로 촬영
                </ThemedText>
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.actionSheetOption,
                { backgroundColor: pressed ? theme.backgroundRoot : 'transparent' }
              ]}
              onPress={() => {
                setShowImageOptions(false);
                setShowAvatarPicker(true);
              }}
            >
              <Icon name="happy-outline" size={24} color={primaryColor} />
              <ThemedText style={[styles.actionSheetOptionText, { color: theme.text }]}>
                아바타 선택
              </ThemedText>
            </Pressable>

            <View style={[styles.actionSheetDivider, { backgroundColor: theme.tabIconDefault + '30' }]} />

            <Pressable
              style={({ pressed }) => [
                styles.actionSheetOption,
                { backgroundColor: pressed ? theme.backgroundRoot : 'transparent' }
              ]}
              onPress={() => setShowImageOptions(false)}
            >
              <ThemedText style={[styles.actionSheetCancelText, { color: BrandColors.error }]}>
                취소
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showAvatarPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAvatarPicker(false)}
        >
          <View style={[styles.actionSheet, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.actionSheetTitle, { color: theme.text }]}>
              아바타 선택
            </ThemedText>

            <View style={styles.avatarGrid}>
              {AVATAR_OPTIONS.map((avatar) => {
                const isSelected = (profile?.profileImageUrl || profile?.profileImage) === avatar.id;
                return (
                  <Pressable
                    key={avatar.id}
                    style={({ pressed }) => [
                      styles.avatarOption,
                      {
                        backgroundColor: isSelected ? primaryColor + '20' : theme.backgroundRoot,
                        borderColor: isSelected ? primaryColor : 'transparent',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    onPress={() => handleSelectAvatar(avatar.id)}
                  >
                    <ThemedText style={styles.avatarEmoji}>{avatar.emoji}</ThemedText>
                    <ThemedText style={[styles.avatarLabel, { color: theme.tabIconDefault }]}>
                      {avatar.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.actionSheetDivider, { backgroundColor: theme.tabIconDefault + '30' }]} />

            <Pressable
              style={({ pressed }) => [
                styles.actionSheetOption,
                { backgroundColor: pressed ? theme.backgroundRoot : 'transparent' }
              ]}
              onPress={() => setShowAvatarPicker(false)}
            >
              <ThemedText style={[styles.actionSheetCancelText, { color: BrandColors.error }]}>
                취소
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function MenuItem({
  icon,
  label,
  description,
  theme,
  badge,
  badgeColor,
  onPress
}: {
  icon: string;
  label: string;
  description?: string;
  theme: any;
  badge?: string;
  badgeColor?: string;
  onPress: () => void
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        {
          backgroundColor: theme.backgroundDefault,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.menuItemLeft}>
        <Icon name={icon as any} size={20} color={theme.text} />
        <View style={styles.menuItemTextContainer}>
          <View style={styles.labelRow}>
            <ThemedText style={[styles.menuItemLabel, { color: theme.text }]}>{label}</ThemedText>
            {badge ? (
              <View style={[styles.badgeContainer, { backgroundColor: badgeColor || '#EF4444' }]}>
                <ThemedText style={styles.badgeText}>{badge}</ThemedText>
              </View>
            ) : null}
          </View>
          {description ? (
            <ThemedText style={[styles.menuItemDescription, { color: theme.tabIconDefault }]}>
              {description}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <Icon name="chevron-forward-outline" size={20} color={theme.tabIconDefault} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    padding: Spacing['2xl'],
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userName: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
  },
  roleBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
  },
  roleBadgeText: {
    ...Typography.small,
    fontWeight: '600',
  },
  userEmail: {
    ...Typography.body,
    marginBottom: Spacing.xs,
  },
  userPhone: {
    ...Typography.small,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E0E0E0',
  },
  statValue: {
    ...Typography.h4,
  },
  statLabel: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  menuSection: {
    marginBottom: Spacing['2xl'],
  },
  sectionTitle: {
    ...Typography.small,
    fontWeight: '600',
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  menuItemTextContainer: {
    flex: 1,
  },
  menuItemLabel: {
    ...Typography.body,
  },
  menuItemDescription: {
    ...Typography.small,
    marginTop: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  badgeContainer: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  badgeText: {
    ...Typography.small,
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  teamCard: {
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  teamIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamDetails: {},
  teamName: {
    ...Typography.body,
    fontWeight: '600',
  },
  teamMemberCount: {
    ...Typography.small,
    marginTop: 2,
  },
  teamAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  teamActionText: {
    ...Typography.body,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.error,
    marginTop: Spacing.lg,
  },
  logoutText: {
    ...Typography.body,
    color: BrandColors.error,
    fontWeight: '600',
  },
  versionText: {
    ...Typography.small,
    textAlign: 'center',
    marginTop: Spacing['2xl'],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['2xl'],
  },
  actionSheetTitle: {
    ...Typography.h4,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  actionSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  actionSheetOptionText: {
    ...Typography.body,
  },
  actionSheetDivider: {
    height: 1,
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.xl,
  },
  actionSheetCancelText: {
    ...Typography.body,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  avatarOption: {
    width: 80,
    height: 90,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  avatarEmoji: {
    fontSize: 36,
  },
  avatarLabel: {
    ...Typography.small,
    marginTop: Spacing.xs,
    fontSize: 11,
  },
});
