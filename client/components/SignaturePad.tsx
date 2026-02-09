import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  PanResponder,
  Platform,
} from 'react-native';
import { Icon } from "@/components/Icon";
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, BrandColors } from '@/constants/theme';

interface Point {
  x: number;
  y: number;
}

interface SignaturePadProps {
  onSignatureChange: (hasSignature: boolean, signatureData: string | null) => void;
  width?: number;
  height?: number;
  primaryColor?: string;
}

export function SignaturePad({ 
  onSignatureChange, 
  width = 300, 
  height = 150,
  primaryColor = BrandColors.requester,
}: SignaturePadProps) {
  const { theme, isDark } = useTheme();
  const [paths, setPaths] = useState<Point[][]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const containerRef = useRef<View>(null);
  const containerOffsetRef = useRef({ x: 0, y: 0 });
  
  const pathsRef = useRef<Point[][]>([]);
  const currentPathRef = useRef<Point[]>([]);
  const onSignatureChangeRef = useRef(onSignatureChange);
  onSignatureChangeRef.current = onSignatureChange;

  const handleLayout = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.measure((x, y, w, h, pageX, pageY) => {
        containerOffsetRef.current = { x: pageX, y: pageY };
      });
    }
  }, []);

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
    }), [handleLayout]);

  const clearSignature = () => {
    pathsRef.current = [];
    currentPathRef.current = [];
    setPaths([]);
    setCurrentPath([]);
    onSignatureChange(false, null);
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
          
          return (
            <View
              key={index}
              style={{
                position: 'absolute',
                left: prevPoint.x,
                top: prevPoint.y - 1,
                width: distance,
                height: 2,
                backgroundColor: theme.text,
                transform: [{ rotate: `${angle}deg` }],
              }}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View 
        ref={containerRef}
        style={[
          styles.canvas, 
          { 
            width, 
            height, 
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
            <Icon name="create-outline" size={24} color={isDark ? '#666' : '#CCC'} />
            <ThemedText style={[styles.placeholderText, { color: isDark ? '#666' : '#999' }]}>
              여기에 서명해 주세요
            </ThemedText>
          </View>
        ) : null}
      </View>
      
      {hasSignature ? (
        <Pressable style={styles.clearButton} onPress={clearSignature}>
          <Icon name="trash-outline" size={16} color={BrandColors.error} />
          <ThemedText style={styles.clearText}>서명 지우기</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
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
});
