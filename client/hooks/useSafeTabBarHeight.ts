import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

/**
 * Bottom Tab Navigator 밖에서도 안전하게 사용할 수 있는 useBottomTabBarHeight 래퍼.
 * Tab Navigator 밖(RootStack 등)에서 호출 시 에러 대신 0을 반환합니다.
 */
export function useSafeTabBarHeight(): number {
  try {
    return useBottomTabBarHeight();
  } catch {
    return 0;
  }
}
