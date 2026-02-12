import React, { useEffect } from 'react';
import { StyleSheet, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { SpringConfigs } from '@/constants/theme';

interface TossLogoProps {
  size?: 'small' | 'large';
}

export function TossLogo({
  size = 'small',
}: TossLogoProps) {
  const { isDark } = useTheme();
  const scale = useSharedValue(0.95);

  useEffect(() => {
    // Subtle spring entrance animation
    scale.value = withSpring(1, SpringConfigs.gentle);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const logoSize = size === 'large' ? { width: 200, height: 65 } : { width: 90, height: 30 };

  // Use hellpme-logo.png for all pages
  const logoSource = require('@/assets/images/hellpme-logo.png');

  return (
    <Animated.View style={animatedStyle} accessibilityLabel="헬프미">
      <Image
        source={logoSource}
        style={[styles.logo, logoSize]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  logo: {
    // Size will be set inline based on size prop
  },
});
