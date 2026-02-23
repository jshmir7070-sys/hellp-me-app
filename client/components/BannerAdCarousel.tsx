import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  Dimensions,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { getApiUrl } from "@/lib/query-client";
import { Spacing } from "@/constants/theme";

interface BannerAd {
  id: number;
  title: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
}

interface BannerAdCarouselProps {
  style?: StyleProp<ViewStyle>;
}

const ROTATION_INTERVAL = 3500; // 3.5초
const BANNER_ASPECT_RATIO = 4; // 4:1 띠배너 비율 (1200×300)

export function BannerAdCarousel({ style }: BannerAdCarouselProps) {
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [bannerWidth, setBannerWidth] = useState(
    Dimensions.get("window").width
  );

  const { data: banners = [] } = useQuery<BannerAd[]>({
    queryKey: ["/api/announcements/banners"],
    staleTime: 5 * 60 * 1000, // 5분
  });

  // 자동 회전
  const startAutoRotate = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (banners.length <= 1) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * bannerWidth, animated: true });
        return next;
      });
    }, ROTATION_INTERVAL);
  }, [banners.length, bannerWidth]);

  useEffect(() => {
    startAutoRotate();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startAutoRotate]);

  const handleScrollEnd = useCallback(
    (e: any) => {
      const index = Math.round(
        e.nativeEvent.contentOffset.x / bannerWidth
      );
      setCurrentIndex(index);
      startAutoRotate();
    },
    [bannerWidth, startAutoRotate]
  );

  const handleBannerPress = useCallback((banner: BannerAd) => {
    if (banner.linkUrl) {
      const url = banner.linkUrl.startsWith("http")
        ? banner.linkUrl
        : `https://${banner.linkUrl}`;
      Linking.openURL(url).catch(() => {});
    }
  }, []);

  const handleLayout = useCallback((e: any) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) setBannerWidth(width);
  }, []);

  // 배너 없으면 렌더 안함
  if (banners.length === 0) return null;

  const apiUrl = getApiUrl().replace(/\/$/, "");

  return (
    <View
      style={[styles.container, style]}
      onLayout={handleLayout}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={{ width: bannerWidth }}
        scrollEventThrottle={16}
      >
        {banners.map((banner) => (
          <Pressable
            key={banner.id}
            onPress={() => handleBannerPress(banner)}
            style={{ width: bannerWidth }}
          >
            {banner.imageUrl ? (
              <ExpoImage
                source={{
                  uri: banner.imageUrl.startsWith("http")
                    ? banner.imageUrl
                    : `${apiUrl}${banner.imageUrl}`,
                }}
                style={[styles.bannerImage, { width: bannerWidth }]}
                contentFit="cover"
                transition={300}
              />
            ) : (
              <View
                style={[
                  styles.bannerPlaceholder,
                  { width: bannerWidth, backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <ThemedText style={{ color: theme.tabIconDefault, fontSize: 14 }}>
                  {banner.title}
                </ThemedText>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>

      {/* AD 라벨 */}
      <View style={styles.adLabel}>
        <ThemedText style={styles.adLabelText}>AD</ThemedText>
      </View>

      {/* 도트 인디케이터 (2개 이상일 때만) */}
      {banners.length > 1 ? (
        <View style={styles.dotsContainer}>
          {banners.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    idx === currentIndex
                      ? "#FFFFFF"
                      : "rgba(255,255,255,0.4)",
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  bannerImage: {
    aspectRatio: BANNER_ASPECT_RATIO,
  },
  bannerPlaceholder: {
    aspectRatio: BANNER_ASPECT_RATIO,
    justifyContent: "center",
    alignItems: "center",
  },
  adLabel: {
    position: "absolute",
    top: Spacing.xs,
    left: Spacing.xs,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
  },
  adLabelText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  dotsContainer: {
    position: "absolute",
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
