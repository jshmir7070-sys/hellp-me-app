import { useState, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '@/lib/query-client';

export type DocumentType = 'businessCert' | 'driverLicense' | 'cargoLicense' | 'vehicleCert' | 'bankAccountCert' | 'transportContract';

export interface DocumentState {
  uri: string | null;
  uploaded: boolean;
  url: string | null;
  uploading: boolean;
}

export function useDocumentUpload() {
  const [documents, setDocuments] = useState<Record<DocumentType, DocumentState>>({
    businessCert: { uri: null, uploaded: false, url: null, uploading: false },
    driverLicense: { uri: null, uploaded: false, url: null, uploading: false },
    cargoLicense: { uri: null, uploaded: false, url: null, uploading: false },
    vehicleCert: { uri: null, uploaded: false, url: null, uploading: false },
    bankAccountCert: { uri: null, uploaded: false, url: null, uploading: false },
    transportContract: { uri: null, uploaded: false, url: null, uploading: false },
  });

  const pickImage = async (docType: DocumentType) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setDocuments(prev => ({
        ...prev,
        [docType]: { ...prev[docType], uri: result.assets[0].uri, uploaded: false },
      }));
      await uploadDocument(docType, result.assets[0].uri);
    }
  };

  const takePhoto = async (docType: DocumentType) => {
    if (Platform.OS === 'web') {
      await pickImage(docType);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setDocuments(prev => ({
        ...prev,
        [docType]: { ...prev[docType], uri: result.assets[0].uri, uploaded: false },
      }));
      await uploadDocument(docType, result.assets[0].uri);
    }
  };

  const selectImage = useCallback(async (docType: DocumentType) => {
    if (Platform.OS === 'web') {
      await pickImage(docType);
    } else {
      Alert.alert(
        '이미지 선택',
        '이미지를 어떻게 추가하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '갤러리에서 선택', onPress: () => pickImage(docType) },
          { text: '카메라로 촬영', onPress: () => takePhoto(docType) },
        ]
      );
    }
  }, []);

  const uploadDocument = async (docType: DocumentType, uri: string) => {
    setDocuments(prev => ({
      ...prev,
      [docType]: { ...prev[docType], uploading: true },
    }));

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const formData = new FormData();

      const uriParts = uri.split('.');
      const fileType = uriParts[uriParts.length - 1] || 'jpg';

      if (Platform.OS === 'web') {
        const blobResponse = await fetch(uri);
        const blob = await blobResponse.blob();
        formData.append('file', blob, `${docType}.${fileType}`);
      } else {
        formData.append('file', {
          uri: uri,
          name: `${docType}.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      }
      formData.append('type', docType);

      const response = await fetch(
        new URL('/api/helpers/credential/upload', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        const result = await response.json();
        setDocuments(prev => ({
          ...prev,
          [docType]: { ...prev[docType], uploaded: true, url: result.url, uploading: false },
        }));
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || '업로드 실패');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setDocuments(prev => ({
        ...prev,
        [docType]: { ...prev[docType], uploading: false, uri: null },
      }));
      if (Platform.OS === 'web') {
        alert('업로드 실패: ' + (error.message || '다시 시도해주세요.'));
      } else {
        Alert.alert('업로드 실패', error.message || '다시 시도해주세요.');
      }
    }
  };

  const resetDocument = (docType: DocumentType) => {
    setDocuments(prev => ({
      ...prev,
      [docType]: { uri: null, uploaded: false, url: null, uploading: false },
    }));
  };

  return {
    documents,
    selectImage,
    resetDocument,
    setDocuments,
  };
}
