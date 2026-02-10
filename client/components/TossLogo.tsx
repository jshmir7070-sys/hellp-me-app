import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { SpringConfigs, PremiumGradients } from '@/constants/theme';

interface TossLogoProps {
  size?: 'small' | 'large';
  color?: string;
  gradient?: boolean;
}

export function TossLogo({
  size = 'small',
  color,
  gradient = false,
}: TossLogoProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(0.95);

  useEffect(() => {
    // Subtle spring entrance animation
    scale.value = withSpring(1, SpringConfigs.gentle);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const fontSize = size === 'large' ? 36 : 22;
  const letterSpacing = size === 'large' ? -0.8 : -0.5;
  const fontWeight = '800' as const;

  const logoText = '헬프미';
  const defaultColor = color || theme.text;

  // If gradient is enabled, use MaskedView with LinearGradient
  if (gradient && Platform.OS !== 'web') {
    return (
      <Animated.View style={animatedStyle} accessibilityLabel="헬프미">
        <MaskedView
          maskElement={
            <View style={styles.maskContainer}>
              <Text
                style={[
                  styles.text,
                  {
                    fontSize,
                    letterSpacing,
                    fontWeight,
                  },
                ]}
              >
                {logoText}
              </Text>
            </View>
          }
        >
          <LinearGradient
            colors={PremiumGradients.blue}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: '100%', height: '100%' }}
          >
            <Text
              style={[
                styles.text,
                styles.transparent,
                {
                  fontSize,
                  letterSpacing,
                  fontWeight,
                },
              ]}
            >
              {logoText}
            </Text>
          </LinearGradient>
        </MaskedView>
      </Animated.View>
    );
  }

  // Fallback: solid color text (for web or when gradient disabled)
  return (
    <Animated.View style={animatedStyle} accessibilityLabel="헬프미">
      <Text
        style={[
          styles.text,
          {
            fontSize,
            letterSpacing,
            fontWeight,
            color: defaultColor,
          },
        ]}
      >
        {logoText}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  text: {
    textAlign: 'center',
  },
  transparent: {
    opacity: 0,
  },
  maskContainer: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
