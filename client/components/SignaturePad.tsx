import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  PanResponder,
  Platform,
  Modal,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { Icon } from "@/components/Icon";
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, BrandColors, Colors } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Point {
  x: number;
  y: number;
}

interface SignaturePadProps {
  onSignatureChange: (hasSignature: boolean, signatureData: string | null) => void;
  width?: number;
  height?: number;
  primaryColor?: string;
  fullScreenMode?: boolean; // 전체 화면 모달 모드
}

export function SignaturePad({ 
  onSignatureChange, 
  width = 300, 
  height = 150,
  primaryColor = BrandColors.requester,
  fullScreenMode = true, // 기본값을 true로 설정
}: SignaturePadProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  
  const [paths, setPaths] = useState<Point[][]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [sensitivity, setSensitivity] = useState(4); // 기본값 4단계 (1~7)
  
  const containerRef = useRef<View>(null);
  const containerOffsetRef = useRef({ x: 0, y: 0 });
  
  const pathsRef = useRef<Point[][]>([]);
  const currentPathRef = useRef<Point[]>([]);
  const onSignatureChangeRef = useRef(onSignatureChange);
  onSignatureChangeRef.current = onSignatureChange;

  // 민감도에 따른 간격 (픽셀)
  const getSensitivityThreshold = () => {
    const thresholds = [15, 12, 10, 8, 6, 4, 2]; // 1단계(15px)~7단계(2px)
    return thresholds[sensitivity - 1] || 8;
  };

  const handleLayout = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.measure((x, y, w, h, pageX, pageY) => {
        containerOffsetRef.current = { x: pageX, y: pageY };
      });
    }
  }, []);

  // 두 점 사이의 거리 계산
  const getDistance = (p1: Point, p2: Point) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = useMemo(() => 
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        handleLayout();
        const { pageX, pageY } = evt.nativeEvent;
        const x = pageX - containerOffsetRef.current.x;
        const y = pageY - containerOffsetRef.current.y;
        currentPathRef.current = [{ x, y }];
        setCurrentPath([{ x, y }]);
      },
      onPanResponderMove: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const x = pageX - containerOffsetRef.current.x;
        const y = pageY - containerOffsetRef.current.y;
        
        // 민감도 체크: 이전 점과의 거리가 threshold 이상일 때만 추가
        const threshold = getSensitivityThreshold();
        if (currentPathRef.current.length > 0) {
          const lastPoint = currentPathRef.current[currentPathRef.current.length - 1];
          const distance = getDistance(lastPoint, { x, y });
          
          if (distance < threshold) {
            return; // 너무 가까우면 스킵
          }
        }
        
        currentPathRef.current = [...currentPathRef.current, { x, y }];
        setCurrentPath([...currentPathRef.current]);
      },
      onPanResponderRelease: () => {
        if (currentPathRef.current.length > 0) {
          const newPaths = [...pathsRef.current, currentPathRef.current];
          pathsRef.current = newPaths;
          setPaths(newPaths);
          currentPathRef.current = [];
          setCurrentPath([]);
          const signatureData = JSON.stringify(newPaths);
          onSignatureChangeRef.current(true, signatureData);
        }
      },
    }), [handleLayout, sensitivity]);

  const clearSignature = () => {
    pathsRef.current = [];
    currentPathRef.current = [];
    setPaths([]);
    setCurrentPath([]);
    onSignatureChange(false, null);
  };

  const handleComplete = () => {
    setShowModal(false);
  };

  const handleCancel = () => {
    clearSignature();
    setShowModal(false);
  };

  const hasSignature = paths.length > 0;

  const renderPath = (points: Point[], key: number) => {
    if (points.length < 2) return null;
    
    return (
      <View key={key} style={StyleSheet.absoluteFill} pointerEvents="none">
        {points.map((point, index) => {
          if (index === 0) return null;
          const prevPoint = points[index - 1];
          const dx = point.x - prevPoint.x;
          const dy = point.y - prevPoint.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          
          // 민감도에 따라 선 굵기 조정 (민감도 높을수록 얇게)
          const lineThickness = sensitivity >= 6 ? 1.5 : sensitivity >= 4 ? 2 : 2.5;
          
          return (
            <View
              key={index}
              style={{
                position: 'absolute',
                left: prevPoint.x,
                top: prevPoint.y - lineThickness / 2,
                width: distance,
                height: lineThickness,
                backgroundColor: theme.text,
                transform: [{ rotate: `${angle}deg` }],
              }}
            />
          );
        })}
      </View>
    );
  };

  // 민감도 선택 UI
  const renderSensitivitySelector = () => (
    <View style={styles.sensitivityContainer}>
      <View style={styles.sensitivityHeader}>
        <Icon name="settings-outline" size={18} color={theme.text} />
        <ThemedText style={[styles.sensitivityLabel, { color: theme.text }]}>
          민감도 조정
        </ThemedText>
      </View>
      <View style={styles.sensitivityLevels}>
        {[1, 2, 3, 4, 5, 6, 7].map((level) => (
          <Pressable
            key={level}
            style={[
              styles.sensitivityButton,
              {
                backgroundColor: sensitivity === level 
                  ? primaryColor 
                  : (isDark ? Colors.dark.backgroundSecondary : '#F0F0F0'),
              },
            ]}
            onPress={() => setSensitivity(level)}
          >
            <ThemedText
              style={[
                styles.sensitivityButtonText,
                {
                  color: sensitivity === level ? '#FFFFFF' : theme.text,
                  fontWeight: sensitivity === level ? '700' : '400',
                },
              ]}
            >
              {level}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      <View style={styles.sensitivityHints}>
        <ThemedText style={[styles.sensitivityHintText, { color: Colors.light.tabIconDefault }]}>
          낮음 (부드럽게)
        </ThemedText>
        <ThemedText style={[styles.sensitivityHintText, { color: Colors.light.tabIconDefault }]}>
          높음 (정밀하게)
        </ThemedText>
      </View>
    </View>
  );

  const canvasWidth = fullScreenMode && showModal ? screenWidth - Spacing.lg * 2 : width;
  const canvasHeight = fullScreenMode && showModal ? screenHeight * 0.5 : height;

  const signaturePadContent = (
    <View style={fullScreenMode ? styles.fullScreenContainer : styles.container}>
      {fullScreenMode && showModal && renderSensitivitySelector()}
      
      <View 
        ref={containerRef}
        style={[
          styles.canvas, 
          { 
            width: canvasWidth, 
            height: canvasHeight, 
            backgroundColor: isDark ? '#1a1a2e' : '#FAFAFA',
            borderColor: hasSignature ? primaryColor : (isDark ? '#444' : '#E0E0E0'),
          }
        ]}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        {paths.map((path, index) => renderPath(path, index))}
        {renderPath(currentPath, -1)}
        
        {!hasSignature && currentPath.length === 0 ? (
          <View style={styles.placeholder} pointerEvents="none">
            <Icon name="create-outline" size={fullScreenMode ? 40 : 24} color={isDark ? '#666' : '#CCC'} />
            <ThemedText style={[
              styles.placeholderText, 
              { 
                color: isDark ? '#666' : '#999',
                fontSize: fullScreenMode ? 18 : 14,
              }
            ]}>
              {fullScreenMode ? '화면에 서명해 주세요' : '여기에 서명해 주세요'}
            </ThemedText>
          </View>
        ) : null}
      </View>
      
      {hasSignature && !fullScreenMode ? (
        <Pressable style={styles.clearButton} onPress={clearSignature}>
          <Icon name="trash-outline" size={16} color={BrandColors.error} />
          <ThemedText style={styles.clearText}>서명 지우기</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );

  if (fullScreenMode) {
    return (
      <>
        <Pressable 
          style={[
            styles.openModalButton,
            { 
              backgroundColor: hasSignature ? primaryColor : (isDark ? Colors.dark.backgroundSecondary : '#F0F0F0'),
              borderColor: hasSignature ? primaryColor : (isDark ? '#444' : '#E0E0E0'),
            }
          ]}
          onPress={() => setShowModal(true)}
        >
          {hasSignature ? (
            <>
              <Icon name="checkmark-circle" size={20} color="#FFFFFF" />
              <ThemedText style={[styles.openModalButtonText, { color: '#FFFFFF' }]}>
                서명 완료 (수정하기)
              </ThemedText>
            </>
          ) : (
            <>
              <Icon name="create-outline" size={20} color={theme.text} />
              <ThemedText style={[styles.openModalButtonText, { color: theme.text }]}>
                서명하기
              </ThemedText>
            </>
          )}
        </Pressable>

        <Modal
          visible={showModal}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={handleCancel}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
            {/* 헤더 */}
            <View style={[styles.modalHeader, { borderBottomColor: isDark ? '#333' : '#E0E0E0' }]}>
              <Pressable style={styles.modalHeaderButton} onPress={handleCancel}>
                <Icon name="close-outline" size={28} color={theme.text} />
              </Pressable>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                전자서명
              </ThemedText>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView 
              contentContainerStyle={styles.modalContent}
              bounces={false}
            >
              {signaturePadContent}
            </ScrollView>

            {/* 하단 버튼 */}
            <View style={[styles.modalFooter, { 
              borderTopColor: isDark ? '#333' : '#E0E0E0',
              paddingBottom: insets.bottom + Spacing.lg,
            }]}>
              {hasSignature && (
                <Pressable 
                  style={[styles.modalButton, styles.clearButtonModal, { borderColor: BrandColors.error }]} 
                  onPress={clearSignature}
                >
                  <Icon name="trash-outline" size={20} color={BrandColors.error} />
                  <ThemedText style={[styles.modalButtonText, { color: BrandColors.error }]}>
                    지우기
                  </ThemedText>
                </Pressable>
              )}
              <Pressable 
                style={[
                  styles.modalButton, 
                  styles.completeButton,
                  { 
                    backgroundColor: hasSignature ? primaryColor : (isDark ? '#444' : '#D0D0D0'),
                    flex: hasSignature ? 1 : undefined,
                  }
                ]} 
                onPress={handleComplete}
                disabled={!hasSignature}
              >
                <Icon name="checkmark-outline" size={20} color="#FFFFFF" />
                <ThemedText style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                  완료
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return signaturePadContent;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  fullScreenContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  canvas: {
    borderWidth: 2,
    borderRadius: BorderRadius.md,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  placeholderText: {
    fontSize: 14,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
  },
  clearText: {
    fontSize: 14,
    color: BrandColors.error,
  },
  // 전체 화면 모달 스타일
  openModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginVertical: Spacing.md,
  },
  openModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalHeaderButton: {
    padding: Spacing.xs,
    width: 40,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    minWidth: 120,
  },
  clearButtonModal: {
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  completeButton: {
    flex: 1,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // 민감도 조정 UI
  sensitivityContainer: {
    width: '100%',
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  sensitivityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sensitivityLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  sensitivityLevels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  sensitivityButton: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
    maxWidth: 48,
  },
  sensitivityButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sensitivityHints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  sensitivityHintText: {
    fontSize: 11,
  },
});
