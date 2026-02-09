import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { Icon } from "@/components/Icon";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  BorderRadius,
  Spacing,
  PremiumGradients,
  BrandColors,
} from "@/constants/theme";

type AvatarSize = "sm" | "md" | "lg" | "xl" | "2xl";
type BorderType = "none" | "solid" | "gradient";

interface BadgeConfig {
  text: string;
  color?: "gold" | "purple" | "blue" | "green";
}

interface AvatarProps {
  // Legacy props (하위 호환)
  uri?: string | null;
  size?: number | AvatarSize;
  isHelper?: boolean;
  style?: ViewStyle;
  iconName?: string;

  // 🎨 Premium props
  name?: string;
  badge?: BadgeConfig;
  border?: BorderType;
  online?: boolean;
}

export function Avatar({
  uri,
  size = "md",
  isHelper = true,
  style,
  iconName = 'user',
  name,
  badge,
  border = "none",
  online = false,
}: AvatarProps) {
  const { theme } = useTheme();
  const [hasError, setHasError] = useState(false);

  // Get size dimensions
  const getSizeDimensions = () => {
    if (typeof size === 'number') {
      return {
        size,
        fontSize: size * 0.4,
        badgeSize: Math.max(16, size * 0.3),
        onlineSize: Math.max(8, size * 0.2)
      };
    }

    switch (size) {
      case "sm":
        return { size: 32, fontSize: 14, badgeSize: 16, onlineSize: 8 };
      case "md":
        return { size: 48, fontSize: 18, badgeSize: 20, onlineSize: 12 };
      case "lg":
        return { size: 64, fontSize: 24, badgeSize: 24, onlineSize: 14 };
      case "xl":
        return { size: 80, fontSize: 30, badgeSize: 28, onlineSize: 16 };
      case "2xl":
        return { size: 120, fontSize: 48, badgeSize: 36, onlineSize: 20 };
      default:
        return { size: 48, fontSize: 18, badgeSize: 20, onlineSize: 12 };
    }
  };

  const dimensions = getSizeDimensions();
  const backgroundColor = isHelper ? BrandColors.helperLight : BrandColors.requesterLight;
  const iconColor = isHelper ? BrandColors.helper : BrandColors.requester;

  // Get initials from name
  const getInitials = (name?: string): string => {
    if (!name) return "?";
    const words = name.trim().split(" ");
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get badge gradient
  const getBadgeGradient = (): string[] => {
    switch (badge?.color) {
      case "gold":
        return PremiumGradients.gold;
      case "purple":
        return PremiumGradients.purple;
      case "blue":
        return PremiumGradients.blue;
      case "green":
        return PremiumGradients.success;
      default:
        return PremiumGradients.gold;
    }
  };

  const containerStyle: ViewStyle = {
    width: dimensions.size,
    height: dimensions.size,
    borderRadius: dimensions.size / 2,
    backgroundColor,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  };

  // Render avatar content
  const renderAvatarContent = () => {
    // If has image
    if (uri && !hasError) {
      return (
        <Image
          source={{ uri }}
          style={{ width: dimensions.size, height: dimensions.size }}
          contentFit="cover"
          onError={() => setHasError(true)}
          transition={200}
        />
      );
    }

    // If has name, show initials
    if (name) {
      return (
        <ThemedText
          style={[
            styles.initials,
            {
              fontSize: dimensions.fontSize,
              color: theme.text,
            },
          ]}
        >
          {getInitials(name)}
        </ThemedText>
      );
    }

    // Fallback to icon
    return (
      <Icon
        name={iconName === 'user' ? 'account-outline' : iconName as any}
        size={dimensions.size * 0.5}
        color={iconColor}
      />
    );
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.avatarWrapper}>
        {/* Gradient Border */}
        {border === "gradient" && (
          <LinearGradient
            colors={PremiumGradients.gold}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.gradientBorder,
              {
                width: dimensions.size + 6,
                height: dimensions.size + 6,
                borderRadius: (dimensions.size + 6) / 2,
              },
            ]}
          />
        )}

        {/* Solid Border */}
        {border === "solid" && (
          <View
            style={[
              styles.solidBorder,
              {
                width: dimensions.size + 6,
                height: dimensions.size + 6,
                borderRadius: (dimensions.size + 6) / 2,
                borderColor: theme.link,
              },
            ]}
          />
        )}

        {/* Avatar Content */}
        <View
          style={[
            containerStyle,
            border !== "none" && {
              marginLeft: 3,
              marginTop: 3,
            },
          ]}
        >
          {renderAvatarContent()}
        </View>

        {/* Online Indicator */}
        {online && (
          <View
            style={[
              styles.onlineIndicator,
              {
                width: dimensions.onlineSize,
                height: dimensions.onlineSize,
                borderRadius: dimensions.onlineSize / 2,
                backgroundColor: BrandColors.success,
                borderWidth: 2,
                borderColor: theme.backgroundRoot,
              },
            ]}
          />
        )}

        {/* Badge */}
        {badge && (
          <View
            style={[
              styles.badgeContainer,
              {
                minWidth: dimensions.badgeSize,
                height: dimensions.badgeSize,
                borderRadius: dimensions.badgeSize / 2,
              },
            ]}
          >
            <LinearGradient
              colors={getBadgeGradient()}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.badgeGradient,
                {
                  minWidth: dimensions.badgeSize,
                  height: dimensions.badgeSize,
                  borderRadius: dimensions.badgeSize / 2,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.badgeText,
                  {
                    fontSize: dimensions.badgeSize * 0.5,
                    color: '#FFFFFF',
                  },
                ]}
              >
                {badge.text}
              </ThemedText>
            </LinearGradient>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  avatarWrapper: {
    position: 'relative',
  },
  gradientBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  solidBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 3,
  },
  initials: {
    fontWeight: '600',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  badgeGradient: {
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default Avatar;
