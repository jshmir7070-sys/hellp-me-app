/**
 * 전체화면 이미지 뷰어 모달 (핀치 줌 + 더블탭 줌 + 팬 이동)
 * Android/iOS 모두 지원
 *
 * react-native-gesture-handler v2 + react-native-reanimated v3/4
 */
import React, { useCallback } from 'react';
import { Modal, View, Pressable, Dimensions, StyleSheet } from 'react-native';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

interface ZoomableImageModalProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
}

export function ZoomableImageModal({ visible, imageUri, onClose }: ZoomableImageModalProps) {
  // --- shared values ---
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const savedOffsetX = useSharedValue(0);
  const savedOffsetY = useSharedValue(0);
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);

  const reset = useCallback(() => {
    'worklet';
    scale.value = withTiming(1, { duration: 200 });
    offsetX.value = withTiming(0, { duration: 200 });
    offsetY.value = withTiming(0, { duration: 200 });
    savedScale.value = 1;
    savedOffsetX.value = 0;
    savedOffsetY.value = 0;
  }, []);

  // ── PINCH ──
  const pinch = Gesture.Pinch()
    .onStart((e) => {
      pinchFocalX.value = e.focalX;
      pinchFocalY.value = e.focalY;
    })
    .onUpdate((e) => {
      const newScale = Math.min(Math.max(savedScale.value * e.scale, 1), 5);
      scale.value = newScale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.05) {
        reset();
      } else {
        savedOffsetX.value = offsetX.value;
        savedOffsetY.value = offsetY.value;
      }
    });

  // ── PAN (이동) ──
  const pan = Gesture.Pan()
    .minDistance(5)
    .minPointers(1)
    .maxPointers(2)
    .onUpdate((e) => {
      offsetX.value = savedOffsetX.value + e.translationX;
      offsetY.value = savedOffsetY.value + e.translationY;
    })
    .onEnd(() => {
      savedOffsetX.value = offsetX.value;
      savedOffsetY.value = offsetY.value;
      // 1배 이하로 축소 시 리셋
      if (scale.value <= 1.05) {
        reset();
      }
    });

  // ── DOUBLE TAP ──
  const doubleTap = Gesture.Tap()
    .maxDuration(300)
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > 1.05) {
        reset();
      } else {
        // 탭한 위치를 중심으로 3배 확대
        const targetScale = 3;
        const focusX = e.x - SCREEN_W / 2;
        const focusY = e.y - SCREEN_H / 2;
        scale.value = withTiming(targetScale, { duration: 250 });
        savedScale.value = targetScale;
        offsetX.value = withTiming(-focusX * (targetScale - 1), { duration: 250 });
        offsetY.value = withTiming(-focusY * (targetScale - 1), { duration: 250 });
        savedOffsetX.value = -focusX * (targetScale - 1);
        savedOffsetY.value = -focusY * (targetScale - 1);
      }
    });

  // 핀치와 팬을 동시에 인식, 더블탭은 별도
  const composed = Gesture.Simultaneous(pinch, pan);
  const gesture = Gesture.Exclusive(doubleTap, composed);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
  }));

  const handleClose = () => {
    scale.value = 1;
    savedScale.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
    savedOffsetX.value = 0;
    savedOffsetY.value = 0;
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={gesture}>
          <Animated.Image
            source={imageUri ? { uri: imageUri } : undefined}
            style={[styles.image, animatedStyle]}
            resizeMode="contain"
          />
        </GestureDetector>
        <Pressable style={styles.closeButton} onPress={handleClose}>
          <Feather name="x-circle" size={32} color="#fff" />
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
    zIndex: 10,
  },
});
