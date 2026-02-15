import React, { useState, useEffect } from "react";
import { View, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, Image, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { AddressInput } from "@/components/AddressInput";
import { Avatar } from "@/components/Avatar";
import { Spacing, BorderRadius, Typography, BrandColors, Colors } from "@/constants/theme";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getToken } from '@/utils/secure-token-storage';

type EditProfileScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function EditProfileScreen({ navigation }: EditProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const { user, refreshUser } = useAuth();

  const isHelper = user?.role === 'helper';
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;

  const [name, setName] = useState(user?.name || '');
  const [nickname, setNickname] = useState((user as any)?.nickname || '');
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [originalPhone, setOriginalPhone] = useState(user?.phoneNumber || '');

  useEffect(() => {
    loadUserProfile();
  }, []);

  async function loadUserProfile() {
    setIsLoading(true);
    try {
      const response = await fetch(new URL('/api/auth/me', getApiUrl()).toString(), {
        headers: {
          'Authorization': `Bearer ${await getToken()}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setName(data.user.name || '');
          setNickname(data.user.nickname || '');
          setPhoneNumber(data.user.phoneNumber || '');
          setOriginalPhone(data.user.phoneNumber || '');
          setProfileImageUrl(data.user.profileImageUrl || null);
          if (data.user.address) {
            const parts = data.user.address.split(' ');
            if (parts.length > 3) {
              const mainAddress = parts.slice(0, -1).join(' ');
              const detail = parts[parts.length - 1];
              setAddress(mainAddress);
              setAddressDetail(detail);
            } else {
              setAddress(data.user.address);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePickProfileImage() {
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
  }

  async function uploadProfileImage(uri: string) {
    setIsUploadingImage(true);
    try {
      const token = await getToken();
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
        const data = await uploadResponse.json();
        setProfileImageUrl(data.url);
        Alert.alert('완료', '프로필 사진이 등록되었습니다');
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
  }

  async function handleSendVerificationCode() {
    if (!phoneNumber.trim() || phoneNumber.length < 10) {
      Alert.alert('알림', '올바른 전화번호를 입력해주세요');
      return;
    }

    setIsSendingCode(true);
    try {
      const response = await fetch(new URL('/api/auth/send-signup-code', getApiUrl()).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowPhoneVerification(true);
        let msg = '인증번호가 발송되었습니다.';
        if (data.devCode) {
          msg = `인증번호: ${data.devCode}`;
        }
        Alert.alert('알림', msg);
      } else {
        Alert.alert('오류', data.message || '인증번호 발송에 실패했습니다');
      }
    } catch (err) {
      Alert.alert('오류', '서버 연결에 실패했습니다');
    } finally {
      setIsSendingCode(false);
    }
  }

  async function handleVerifyCode() {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      Alert.alert('알림', '6자리 인증번호를 입력해주세요');
      return;
    }

    setIsVerifyingCode(true);
    try {
      const response = await fetch(new URL('/api/auth/verify-signup-code', getApiUrl()).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumber: phoneNumber.trim(),
          code: verificationCode.trim()
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsPhoneVerified(true);
        setShowPhoneVerification(false);
        Alert.alert('알림', '휴대폰 인증이 완료되었습니다');
      } else {
        Alert.alert('오류', data.message || '인증번호가 올바르지 않습니다');
      }
    } catch (err) {
      Alert.alert('오류', '서버 연결에 실패했습니다');
    } finally {
      setIsVerifyingCode(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('알림', '이름을 입력해주세요');
      return;
    }

    if (phoneNumber !== originalPhone && !isPhoneVerified) {
      Alert.alert('알림', '전화번호가 변경되었습니다. 인증을 완료해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const fullAddress = addressDetail.trim() 
        ? `${address} ${addressDetail.trim()}` 
        : address;

      const token = await getToken();
      const response = await fetch(new URL('/api/helpers/profile', getApiUrl()).toString(), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          nickname: nickname.trim() || undefined,
          phoneNumber: phoneNumber.trim(),
          address: fullAddress || undefined,
        }),
      });

      if (response.ok) {
        await refreshUser();
        Alert.alert('알림', '프로필이 저장되었습니다', [
          { text: '확인', onPress: () => navigation.goBack() }
        ]);
      } else {
        const data = await response.json();
        Alert.alert('오류', data.message || '저장에 실패했습니다');
      }
    } catch (error) {
      console.error('Save profile error:', error);
      Alert.alert('오류', '저장 중 오류가 발생했습니다');
    } finally {
      setIsSaving(false);
    }
  }

  const phoneChanged = phoneNumber !== originalPhone;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={styles.profileImageSection}>
        <Pressable 
          onPress={handlePickProfileImage} 
          disabled={isUploadingImage}
          style={styles.profileImageContainer}
        >
          {profileImageUrl ? (
            profileImageUrl.startsWith('avatar:') ? (
              <Avatar uri={profileImageUrl} size={100} isHelper={user?.role === 'helper'} />
            ) : (
              <Image
                source={{ uri: profileImageUrl.startsWith('http') ? profileImageUrl : `${getApiUrl()}${profileImageUrl}` }}
                style={styles.profileImage}
              />
            )
          ) : (
            <View style={[styles.profileImagePlaceholder, { backgroundColor: primaryColor + '20' }]}>
              <Icon name="person-outline" size={48} color={primaryColor} />
            </View>
          )}
          {isUploadingImage ? (
            <View style={styles.profileImageOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : (
            <View style={[styles.profileImageEditBadge, { backgroundColor: primaryColor }]}>
              <Icon name="camera-outline" size={16} color="#fff" />
            </View>
          )}
        </Pressable>
        <ThemedText style={[styles.profileImageHint, { color: theme.tabIconDefault }]}>
          프로필 사진을 등록하세요
        </ThemedText>
      </View>

      <Card style={styles.formCard}>
        <View style={styles.inputContainer}>
          <ThemedText style={[styles.label, { color: theme.text }]}>이름 (수정불가)</ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? Colors.dark.backgroundSecondary : '#F3F4F6',
                color: theme.tabIconDefault,
                borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
              },
            ]}
            value={name}
            editable={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <ThemedText style={[styles.label, { color: theme.text }]}>닉네임</ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
              },
            ]}
            placeholder="닉네임을 입력하세요 (요청자에게 표시)"
            placeholderTextColor={Colors.light.tabIconDefault}
            value={nickname}
            onChangeText={setNickname}
            maxLength={20}
          />
          <ThemedText style={[styles.hintText, { color: theme.tabIconDefault }]}>
            요청자에게 이름 대신 닉네임이 표시됩니다
          </ThemedText>
        </View>

        <View style={styles.inputContainer}>
          <ThemedText style={[styles.label, { color: theme.text }]}>주소</ThemedText>
          <AddressInput
            value={address}
            onChangeAddress={setAddress}
            placeholder="주소를 검색하세요"
          />
        </View>

        <View style={styles.inputContainer}>
          <ThemedText style={[styles.label, { color: theme.text }]}>상세주소</ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
              },
            ]}
            placeholder="상세주소 (동/호수 등)"
            placeholderTextColor={Colors.light.tabIconDefault}
            value={addressDetail}
            onChangeText={setAddressDetail}
          />
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.labelRow}>
            <ThemedText style={[styles.label, { color: theme.text }]}>휴대폰 번호</ThemedText>
            {isPhoneVerified && phoneChanged ? (
              <View style={styles.verifiedBadge}>
                <Icon name="checkmark-circle-outline" size={14} color={BrandColors.success} />
                <ThemedText style={styles.verifiedText}>인증완료</ThemedText>
              </View>
            ) : null}
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.inputFlex,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                },
              ]}
              placeholder="010-0000-0000"
              placeholderTextColor={Colors.light.tabIconDefault}
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text);
                setIsPhoneVerified(false);
                setShowPhoneVerification(false);
              }}
            />
            {phoneChanged ? (
              <Pressable
                style={[styles.verifyButton, { backgroundColor: primaryColor, opacity: isSendingCode || isPhoneVerified ? 0.7 : 1 }]}
                onPress={handleSendVerificationCode}
                disabled={isSendingCode || isPhoneVerified}
              >
                {isSendingCode ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText style={styles.verifyButtonText}>
                    {isPhoneVerified ? '완료' : '인증'}
                  </ThemedText>
                )}
              </Pressable>
            ) : null}
          </View>
          <ThemedText style={[styles.hintText, { color: theme.tabIconDefault }]}>
            전화번호 변경 시 재인증이 필요합니다
          </ThemedText>
        </View>

        {showPhoneVerification && !isPhoneVerified ? (
          <View style={styles.inputContainer}>
            <ThemedText style={[styles.label, { color: theme.text }]}>인증번호</ThemedText>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.inputFlex,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                  },
                ]}
                placeholder="6자리 인증번호"
                placeholderTextColor={Colors.light.tabIconDefault}
                keyboardType="number-pad"
                maxLength={6}
                value={verificationCode}
                onChangeText={setVerificationCode}
              />
              <Pressable
                style={[styles.verifyButton, { backgroundColor: primaryColor, opacity: isVerifyingCode ? 0.7 : 1 }]}
                onPress={handleVerifyCode}
                disabled={isVerifyingCode}
              >
                {isVerifyingCode ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText style={styles.verifyButtonText}>확인</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </Card>

      <Pressable
        style={[
          styles.saveButton,
          { backgroundColor: primaryColor },
          isSaving && styles.buttonDisabled,
        ]}
        onPress={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <ThemedText style={styles.saveButtonText}>저장하기</ThemedText>
        )}
      </Pressable>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  profileImageContainer: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageEditBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileImageHint: {
    ...Typography.caption,
    marginTop: Spacing.sm,
  },
  formCard: {
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    ...Typography.body,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  inputFlex: {
    flex: 1,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    ...Typography.body,
  },
  verifyButton: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonText: {
    ...Typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  verifiedText: {
    ...Typography.small,
    color: BrandColors.success,
    fontWeight: '500',
  },
  hintText: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  saveButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    ...Typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
