import { Colors } from "@/constants/theme";
import { useThemeContext } from "@/contexts/ThemeContext";

export function useTheme() {
  const { isDark, themeMode, setThemeMode } = useThemeContext();
  const theme = Colors[isDark ? "dark" : "light"];

  return {
    theme,
    isDark,
    themeMode,
    setThemeMode,
  };
}
