import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

export function useUnreadNotifications() {
  const { user } = useAuth();

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ['/api/notifications/unread-count'],
    enabled: !!user,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    select: (data: any) => data?.count ?? 0,
  });

  return unreadCount;
}
