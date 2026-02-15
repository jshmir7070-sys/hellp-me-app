import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle, Text } from 'react-native';
import { Image } from 'expo-image';
import { Icon } from "@/components/Icon";
import { BrandColors } from '@/constants/theme';

const AVATAR_EMOJI_MAP: Record<string, string> = {
  'avatar:delivery': '🚚',
  'avatar:package': '📦',
  'avatar:worker': '👷',
  'avatar:star': '⭐',
  'avatar:rocket': '🚀',
  'avatar:smile': '😊',
};

interface AvatarProps {
  uri?: string | null;
  size?: number;
  isHelper?: boolean;
  style?: ViewStyle;
  iconName?: string;
}

export function Avatar({
  uri,
  size = 60,
  isHelper = true,
  style,
  iconName = 'user'
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  const backgroundColor = isHelper ? BrandColors.helperLight : BrandColors.requesterLight;
  const iconColor = isHelper ? BrandColors.helper : BrandColors.requester;

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  };

  // Emoji avatar
  if (uri && uri.startsWith('avatar:')) {
    const emoji = AVATAR_EMOJI_MAP[uri] || '😊';
    return (
      <View style={[containerStyle, style]}>
        <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
      </View>
    );
  }

  if (uri && !hasError) {
    return (
      <View style={[containerStyle, style]}>
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          onError={() => setHasError(true)}
          transition={200}
        />
      </View>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      <Icon
        name={iconName === 'user' ? 'account-outline' : iconName as any}
        size={size * 0.5}
        color={iconColor}
      />
    </View>
  );
}

export default Avatar;
