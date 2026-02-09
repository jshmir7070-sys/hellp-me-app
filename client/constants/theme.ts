import { Platform } from "react-native";

const tintColorLight = "#1E40AF";
const tintColorDark = "#3B82F6";

export const Colors = {
  light: {
    text: "#111827",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B7280",
    tabIconSelected: tintColorLight,
    link: "#1E40AF",
    backgroundRoot: "#FFFFFF",
    backgroundDefault: "#F3F4F6",
    backgroundSecondary: "#E5E7EB",
    backgroundTertiary: "#D1D5DB",
  },
  dark: {
    text: "#F9FAFB",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9CA3AF",
    tabIconSelected: tintColorDark,
    link: "#3B82F6",
    backgroundRoot: "#111827",
    backgroundDefault: "#1F2937",
    backgroundSecondary: "#374151",
    backgroundTertiary: "#4B5563",
  },
};

export const BrandColors = {
  primary: "#1E40AF",
  primaryLight: "#3B82F6",
  primaryDark: "#1E3A8A",
  helper: "#1E40AF",
  helperLight: "#DBEAFE",
  requester: "#059669",
  requesterLight: "#D1FAE5",
  success: "#22C55E",
  successLight: "#D1FAE5",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  error: "#DC2626",
  errorLight: "#FEE2E2",
  kakao: "#FEE500",
  naver: "#03C75A",
  info: "#3B82F6",
  infoLight: "#DBEAFE",
  scheduled: "#8B5CF6",
  scheduledLight: "#EDE9FE",
  inProgress: "#7C3AED",
  inProgressLight: "#EDE9FE",
  neutral: "#6B7280",
  neutralLight: "#F3F4F6",
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

// ============================================
// 🎨 PREMIUM DESIGN SYSTEM
// ============================================

/**
 * Premium Gradients
 * 프리미엄 그라데이션 색상
 */
export const PremiumGradients = {
  // Primary gradients
  purple: ['#667eea', '#764ba2'],
  blue: ['#4facfe', '#00f2fe'],
  pink: ['#f093fb', '#f5576c'],
  gold: ['#f7971e', '#ffd200'],

  // Accent gradients
  sunset: ['#fa709a', '#fee140'],
  ocean: ['#2193b0', '#6dd5ed'],
  forest: ['#11998e', '#38ef7d'],
  rose: ['#f857a6', '#ff5858'],

  // Dark gradients
  dark: ['#232526', '#414345'],
  midnight: ['#0f2027', '#203a43', '#2c5364'],

  // Business gradients
  business: ['#1E40AF', '#3B82F6'],
  success: ['#059669', '#22C55E'],
  warning: ['#F59E0B', '#FBBF24'],
  error: ['#DC2626', '#EF4444'],
};

/**
 * Premium Colors
 * Glass effect, borders, shadows
 */
export const PremiumColors = {
  // Glass effect colors
  glassLight: 'rgba(255, 255, 255, 0.1)',
  glassMedium: 'rgba(255, 255, 255, 0.15)',
  glassStrong: 'rgba(255, 255, 255, 0.2)',
  glassUltra: 'rgba(255, 255, 255, 0.3)',

  // Glass effect for dark mode
  glassDarkLight: 'rgba(255, 255, 255, 0.05)',
  glassDarkMedium: 'rgba(255, 255, 255, 0.08)',
  glassDarkStrong: 'rgba(255, 255, 255, 0.12)',

  // Border colors
  borderLight: 'rgba(255, 255, 255, 0.1)',
  borderMedium: 'rgba(255, 255, 255, 0.2)',
  borderAccent: 'rgba(247, 151, 30, 0.3)',
  borderGlow: 'rgba(102, 126, 234, 0.5)',

  // Overlay colors
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  overlayMedium: 'rgba(0, 0, 0, 0.5)',
  overlayStrong: 'rgba(0, 0, 0, 0.7)',

  // Backdrop blur colors
  backdropLight: 'rgba(255, 255, 255, 0.8)',
  backdropDark: 'rgba(0, 0, 0, 0.8)',
};

/**
 * Premium Shadows
 * Elevation and depth
 */
export const PremiumShadows = {
  small: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    android: {
      elevation: 4,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
  }),

  medium: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
    },
    android: {
      elevation: 8,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
    },
  }),

  large: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
    },
    android: {
      elevation: 16,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
    },
  }),

  premium: Platform.select({
    ios: {
      shadowColor: '#667eea',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.3,
      shadowRadius: 30,
    },
    android: {
      elevation: 20,
    },
    default: {
      shadowColor: '#667eea',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.3,
      shadowRadius: 30,
    },
  }),

  glow: Platform.select({
    ios: {
      shadowColor: '#f7971e',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
    },
    android: {
      elevation: 12,
    },
    default: {
      shadowColor: '#f7971e',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
    },
  }),
};

/**
 * Animation Configurations
 * Reanimated spring configs
 */
export const SpringConfigs = {
  default: {
    damping: 20,
    mass: 0.5,
    stiffness: 180,
  },
  gentle: {
    damping: 25,
    mass: 0.7,
    stiffness: 150,
  },
  bouncy: {
    damping: 15,
    mass: 0.3,
    stiffness: 200,
  },
  quick: {
    damping: 18,
    mass: 0.4,
    stiffness: 220,
  },
};

/**
 * Premium Blur Intensities
 * For BlurView component
 */
export const BlurIntensity = {
  light: Platform.OS === 'ios' ? 10 : 20,
  medium: Platform.OS === 'ios' ? 20 : 40,
  strong: Platform.OS === 'ios' ? 40 : 60,
  ultra: Platform.OS === 'ios' ? 60 : 80,
};
