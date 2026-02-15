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
