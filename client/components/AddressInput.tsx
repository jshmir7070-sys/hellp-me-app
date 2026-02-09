import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TextInput, Pressable, FlatList, ActivityIndicator, Modal } from 'react-native';
import { Icon } from "@/components/Icon";

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

interface AddressResult {
  address: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName?: string;
}

interface AddressInputProps {
  value: string;
  onChangeAddress: (address: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export function AddressInput({ value, onChangeAddress, placeholder = "주소를 검색하세요", editable = true }: AddressInputProps) {
  const { theme, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<AddressResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchAddress = useCallback(async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        new URL(`/api/address/search?query=${encodeURIComponent(searchQuery)}`, getApiUrl()).toString()
      );
      const data = await response.json();
      if (data.results) {
        setResults(data.results);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Address search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const selectAddress = (address: string) => {
    onChangeAddress(address);
    setModalVisible(false);
    setSearchQuery('');
    setResults([]);
  };

  const openModal = () => {
    if (editable) {
      setModalVisible(true);
    }
  };

  return (
    <>
      <Pressable onPress={openModal}>
        <View
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
            },
          ]}
        >
          <ThemedText
            style={[
              styles.inputText,
              { color: value ? theme.text : Colors.light.tabIconDefault },
            ]}
            numberOfLines={1}
          >
            {value || placeholder}
          </ThemedText>
          <Icon name="search-outline" size={20} color={Colors.light.tabIconDefault} />
        </View>
      </Pressable>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>주소 검색</ThemedText>
            <Pressable onPress={() => setModalVisible(false)} style={styles.closeButton}>
              <Icon name="close-outline" size={24} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                },
              ]}
              placeholder="도로명, 지번, 건물명 검색"
              placeholderTextColor={Colors.light.tabIconDefault}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={searchAddress}
              returnKeyType="search-outline"
              autoFocus
            />
            <Pressable
              style={[styles.searchButton, { backgroundColor: BrandColors.primary }]}
              onPress={searchAddress}
            >
              {isSearching ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Icon name="search-outline" size={20} color="#FFFFFF" />
              )}
            </Pressable>
          </View>

          <FlatList
            data={results}
            keyExtractor={(item, index) => `${item.address}-${index}`}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.resultItem, { borderBottomColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}
                onPress={() => selectAddress(item.roadAddress || item.address)}
              >
                <View style={styles.resultContent}>
                  <ThemedText style={[styles.resultAddress, { color: theme.text }]}>
                    {item.roadAddress || item.address}
                  </ThemedText>
                  {item.jibunAddress && item.jibunAddress !== item.roadAddress ? (
                    <ThemedText style={[styles.resultJibun, { color: Colors.light.tabIconDefault }]}>
                      (지번) {item.jibunAddress}
                    </ThemedText>
                  ) : null}
                  {item.buildingName ? (
                    <ThemedText style={[styles.resultBuilding, { color: BrandColors.primary }]}>
                      {item.buildingName}
                    </ThemedText>
                  ) : null}
                </View>
                <Icon name="chevron-forward-outline" size={20} color={Colors.light.tabIconDefault} />
              </Pressable>
            )}
            ListEmptyComponent={
              searchQuery.length >= 2 && !isSearching ? (
                <View style={styles.emptyContainer}>
                  <ThemedText style={[styles.emptyText, { color: Colors.light.tabIconDefault }]}>
                    검색 결과가 없습니다
                  </ThemedText>
                </View>
              ) : null
            }
            contentContainerStyle={styles.resultsList}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: {
    ...Typography.body,
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    ...Typography.h4,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    ...Typography.body,
  },
  searchButton: {
    width: Spacing.inputHeight,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsList: {
    paddingHorizontal: Spacing.lg,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  resultContent: {
    flex: 1,
  },
  resultAddress: {
    ...Typography.body,
    marginBottom: Spacing.xs,
  },
  resultJibun: {
    ...Typography.small,
  },
  resultBuilding: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  emptyContainer: {
    padding: Spacing['2xl'],
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.body,
  },
});
