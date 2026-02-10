import React, { useState } from "react";
import { View, Pressable, StyleSheet, Alert, Platform, ScrollView, Modal, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { CategorySection } from "@/components/profile/CategorySection";
import { MenuItem } from "@/components/profile/MenuItem";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Typography, BrandColors, Colors } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

type CategoryId = 'profile' | 'documents' | 'work' | 'team' | 'settlement' | 'payment' | 'disputes' | 'settings';

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, logout, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [showImageOptions, setShowImageOptions] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [expandedSection, setExpandedSection] = useState<CategoryId | null>(null);

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

  const profile = isHelper ? helperProfile : requesterProfile;

  const { data: team } = useQuery<Team>({
    queryKey: ['/api/helper/my-team'],
    enabled: isHelper,
  });

  // TODO: Fetch helper documents status for badge count
  const documentsMissing = 0; // Replace with actual logic

  const handleToggleSection = (sectionId: CategoryId) => {
    setExpandedSection(prev => prev === sectionId ? null : sectionId);
  };

  const handleAvatarPress = () => {
    setShowImageOptions(true);
  };

  const handlePickFromGallery = async () => {
    setShowImageOptions(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
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
        allowsEditing: true,
        aspect: [1, 1],
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
      const token = await AsyncStorage.getItem('auth_token');
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, 'profile.jpg');
      } else {
        const file = new File(uri);
        formData.append('file', file as any);
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
      <Card variant="glass" padding="xl" style={styles.profileCard}>
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
                uri={profile?.profileImage ? (profile.profileImage.startsWith('http') ? profile.profileImage : `${getApiUrl()}${profile.profileImage}`) : undefined}
                size={80}
                isHelper={isHelper}
                border="gradient"
                badge={profile?.rating && profile.rating >= 4.5 ? { text: "PRO", color: "gold" } : undefined}
                style={styles.avatarContainer}
              />
            )}
            <View style={[styles.cameraIcon, { backgroundColor: primaryColor }]}>
              <Icon name="camera-outline" size={14} color="#fff" />
            </View>
          </View>
        </Pressable>
        <ThemedText style={[styles.userName, { color: theme.text }]}>
          {profile?.name || user?.name || '사용자'}
        </ThemedText>
        <Badge
          variant="gradient"
          color={isHelper ? "blue" : "green"}
          size="md"
          style={styles.roleBadge}
        >
          {isHelper ? '헬퍼' : '요청자'}
        </Badge>
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
                ★ {profile?.rating?.toFixed(1) || '-'}
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

      {/* Menu Categories - Helper */}
      {isHelper ? (
        <>
          {/* 👤 내 정보 변경 */}
          <CategorySection
            title="👤 내 정보 변경"
            isExpanded={expandedSection === 'profile'}
            onToggle={() => handleToggleSection('profile')}
          >
            <MenuItem
              icon="person-outline"
              label="닉네임 변경"
              onPress={() => navigation.navigate('EditProfile', { field: 'name' })}
            />
            <MenuItem
              icon="location-outline"
              label="주소 변경"
              onPress={() => navigation.navigate('EditProfile', { field: 'address' })}
            />
            <MenuItem
              icon="call-outline"
              label="전화번호 변경"
              onPress={() => navigation.navigate('EditProfile', { field: 'phone' })}
            />
            <MenuItem
              icon="lock-closed-outline"
              label="비밀번호 변경"
              onPress={() => navigation.navigate('ChangePassword')}
            />
          </CategorySection>

          {/* 📄 서류 등록 */}
          <CategorySection
            title="📄 서류 등록"
            isExpanded={expandedSection === 'documents'}
            onToggle={() => handleToggleSection('documents')}
            badge={documentsMissing > 0 ? `🔴 ${documentsMissing}건 미완료` : undefined}
          >
            <MenuItem
              icon="business-outline"
              label="사업자등록증"
              description="세금계산서 발행용"
              onPress={() => navigation.navigate('DocBusiness')}
            />
            <MenuItem
              icon="card-outline"
              label="운전면허증"
              description="헬퍼 인증용"
              onPress={() => navigation.navigate('DocDriverLicense')}
            />
            <MenuItem
              icon="document-text-outline"
              label="화물운송자격증"
              description="택배 배송용 (선택)"
              onPress={() => navigation.navigate('DocCargoLicense')}
            />
            <MenuItem
              icon="car-outline"
              label="차량 등록"
              description="차량번호, 차종"
              onPress={() => navigation.navigate('DocVehicle')}
            />
            <MenuItem
              icon="wallet-outline"
              label="수수료 통장 (정산계좌)"
              description={profile?.bankName ? `${profile.bankName} ${profile.accountNumber?.slice(-4) || ''}` : '정산받을 계좌 등록'}
              onPress={() => navigation.navigate('DocBankAccount')}
            />
            <MenuItem
              icon="document-attach-outline"
              label="운송 계약서 (회사↔나)"
              description="최초 1회 서명"
              onPress={() => navigation.navigate('DocPlatformContract')}
            />
          </CategorySection>

          {/* 📋 업무 */}
          <CategorySection
            title="📋 업무"
            isExpanded={expandedSection === 'work'}
            onToggle={() => handleToggleSection('work')}
          >
            <MenuItem
              icon="list-outline"
              label="수행 이력"
              description="완료된 배송 업무"
              onPress={() => navigation.navigate('HelperHistory')}
            />
            <MenuItem
              icon="camera-outline"
              label="QR 체크인"
              description="요청자 QR 스캔"
              onPress={() => navigation.navigate('QRCheckin')}
            />
          </CategorySection>

          {/* 👥 팀 */}
          <CategorySection
            title="👥 팀"
            isExpanded={expandedSection === 'team'}
            onToggle={() => handleToggleSection('team')}
          >
            {team ? (
              <Card variant="glass" padding="md" style={styles.teamCard}>
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
                label="팀 생성하기"
                description="팀을 만들어 함께 일해보세요"
                onPress={() => navigation.navigate('CreateTeam')}
              />
            )}
          </CategorySection>

          {/* 💰 정산 */}
          <CategorySection
            title="💰 정산"
            isExpanded={expandedSection === 'settlement'}
            onToggle={() => handleToggleSection('settlement')}
          >
            <MenuItem
              icon="cash-outline"
              label="정산 내역"
              description="수익 내역 및 정산 현황"
              onPress={() => navigation.navigate('Settlement')}
            />
          </CategorySection>

          {/* ⚠️ 이의제기·사고 */}
          <CategorySection
            title="⚠️ 이의제기·사고"
            isExpanded={expandedSection === 'disputes'}
            onToggle={() => handleToggleSection('disputes')}
          >
            <MenuItem
              icon="warning-outline"
              label="이의제기 접수"
              description="정산 오류, 수량 차이 등 접수"
              onPress={() => navigation.navigate('HelperDisputeSubmit')}
            />
            <MenuItem
              icon="list-outline"
              label="이의제기 내역"
              description="접수한 이의제기 현황 확인"
              onPress={() => navigation.navigate('HelperDisputeList')}
            />
            <MenuItem
              icon="alert-circle-outline"
              label="사고 내역"
              description="접수된 화물사고 확인 및 응답"
              onPress={() => navigation.navigate('HelperIncidentList')}
            />
          </CategorySection>

          {/* ⚙️ 설정·지원 */}
          <CategorySection
            title="⚙️ 설정·지원"
            isExpanded={expandedSection === 'settings'}
            onToggle={() => handleToggleSection('settings')}
          >
            <MenuItem
              icon="notifications-outline"
              label="알림 설정"
              onPress={() => navigation.navigate('Settings')}
            />
            <MenuItem
              icon="book-outline"
              label="사용 가이드"
              description="앱 사용법 안내"
              onPress={() => navigation.navigate('Help')}
            />
            <MenuItem
              icon="help-circle-outline"
              label="자주 묻는 질문"
              description="FAQ"
              onPress={() => navigation.navigate('Support')}
            />
            <MenuItem
              icon="document-text-outline"
              label="이용약관"
              onPress={() => navigation.navigate('Policy', { type: 'terms' })}
            />
            <MenuItem
              icon="shield-outline"
              label="개인정보 처리방침"
              onPress={() => navigation.navigate('Policy', { type: 'privacy' })}
            />
            <MenuItem
              icon="log-out-outline"
              label="회원탈퇴"
              onPress={() => Alert.alert('회원탈퇴', '회원탈퇴 기능은 준비중입니다')}
            />
          </CategorySection>
        </>
      ) : (
        /* Menu Categories - Requester */
        <>
          {/* 👤 내 정보 변경 */}
          <CategorySection
            title="👤 내 정보 변경"
            isExpanded={expandedSection === 'profile'}
            onToggle={() => handleToggleSection('profile')}
          >
            <MenuItem
              icon="person-outline"
              label="닉네임 변경"
              onPress={() => navigation.navigate('EditProfile', { field: 'name' })}
            />
            <MenuItem
              icon="business-outline"
              label="회사명 변경"
              onPress={() => navigation.navigate('EditProfile', { field: 'company' })}
            />
            <MenuItem
              icon="location-outline"
              label="주소 변경"
              onPress={() => navigation.navigate('EditProfile', { field: 'address' })}
            />
            <MenuItem
              icon="call-outline"
              label="전화번호 변경"
              onPress={() => navigation.navigate('EditProfile', { field: 'phone' })}
            />
            <MenuItem
              icon="lock-closed-outline"
              label="비밀번호 변경"
              onPress={() => navigation.navigate('ChangePassword')}
            />
          </CategorySection>

          {/* 📄 서류 등록 */}
          <CategorySection
            title="📄 서류 등록"
            isExpanded={expandedSection === 'documents'}
            onToggle={() => handleToggleSection('documents')}
          >
            <MenuItem
              icon="business-outline"
              label="사업자정보 등록"
              description={(requesterProfile as any)?.businessNumber ? `사업자번호: ${(requesterProfile as any).businessNumber}` : '세금계산서 발행을 위해 등록해주세요'}
              badge={!(requesterProfile as any)?.businessNumber ? '미등록' : undefined}
              badgeColor={BrandColors.error}
              onPress={() => navigation.navigate('BusinessRegistration')}
            />
          </CategorySection>

          {/* 📋 업무 */}
          <CategorySection
            title="📋 업무"
            isExpanded={expandedSection === 'work'}
            onToggle={() => handleToggleSection('work')}
          >
            <MenuItem
              icon="list-outline"
              label="오더/사용 이력"
              description="완료된 오더 내역"
              onPress={() => navigation.navigate('RequesterHistory')}
            />
            <MenuItem
              icon="qr-code-outline"
              label="내 QR 코드"
              description="헬퍼 출근 확인용"
              onPress={() => navigation.navigate('QRCheckin')}
            />
          </CategorySection>

          {/* 💳 결제 */}
          <CategorySection
            title="💳 결제"
            isExpanded={expandedSection === 'payment'}
            onToggle={() => handleToggleSection('payment')}
          >
            <MenuItem
              icon="card-outline"
              label="결제 수단"
              description="결제 카드 및 계좌 관리"
              onPress={() => navigation.navigate('PaymentSettings')}
            />
            <MenuItem
              icon="wallet-outline"
              label="환불 계좌"
              description={profile?.bankName ? `${profile.bankName} ${profile.accountNumber?.slice(-4) || ''}` : '환불받을 계좌 등록'}
              onPress={() => navigation.navigate('RefundAccount')}
            />
          </CategorySection>

          {/* ⚠️ 이의제기·사고 */}
          <CategorySection
            title="⚠️ 이의제기·사고"
            isExpanded={expandedSection === 'disputes'}
            onToggle={() => handleToggleSection('disputes')}
          >
            <MenuItem
              icon="list-outline"
              label="이의제기 내역"
              description="접수한 이의제기 현황"
              onPress={() => navigation.navigate('RequesterDisputeList')}
            />
            <MenuItem
              icon="alert-circle-outline"
              label="사고 내역"
              description="화물사고 접수 현황"
              onPress={() => navigation.navigate('IncidentList')}
            />
          </CategorySection>

          {/* ⚙️ 설정·지원 */}
          <CategorySection
            title="⚙️ 설정·지원"
            isExpanded={expandedSection === 'settings'}
            onToggle={() => handleToggleSection('settings')}
          >
            <MenuItem
              icon="notifications-outline"
              label="알림 설정"
              onPress={() => navigation.navigate('Settings')}
            />
            <MenuItem
              icon="book-outline"
              label="사용 가이드"
              description="앱 사용법 안내"
              onPress={() => navigation.navigate('Help')}
            />
            <MenuItem
              icon="help-circle-outline"
              label="자주 묻는 질문"
              description="FAQ"
              onPress={() => navigation.navigate('Support')}
            />
            <MenuItem
              icon="document-text-outline"
              label="이용약관"
              onPress={() => navigation.navigate('Policy', { type: 'terms' })}
            />
            <MenuItem
              icon="shield-outline"
              label="개인정보 처리방침"
              onPress={() => navigation.navigate('Policy', { type: 'privacy' })}
            />
            <MenuItem
              icon="log-out-outline"
              label="회원탈퇴"
              onPress={() => Alert.alert('회원탈퇴', '회원탈퇴 기능은 준비중입니다')}
            />
          </CategorySection>
        </>
      )}

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
                navigation.navigate('EditProfile');
              }}
            >
              <Icon name="create-outline" size={24} color={primaryColor} />
              <ThemedText style={[styles.actionSheetOptionText, { color: theme.text }]}>
                프로필 수정
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
    </ScrollView>
  );
}

// MenuItem component extracted to @/components/profile/MenuItem

const styles = StyleSheet.create({
  profileCard: {
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
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.light.backgroundTertiary,
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
    color: Colors.light.buttonText,
    fontWeight: '600',
  },
  teamCard: {
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
});
