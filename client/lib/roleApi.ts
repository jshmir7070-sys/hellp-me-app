import { useAuth } from '@/contexts/AuthContext';

type UserRole = 'helper' | 'requester' | 'admin';

type ApiFeature = 
  | 'profile'
  | 'team'
  | 'work-history'
  | 'scheduled-orders'
  | 'orders'
  | 'reviews'
  | 'settlements'
  | 'refund-account';

const ROLE_API_MAP: Record<UserRole, Partial<Record<ApiFeature, string>>> = {
  helper: {
    'profile': '/api/helpers/profile',
    'team': '/api/helper/my-team',
    'work-history': '/api/helper/work-history',
    'scheduled-orders': '/api/orders/scheduled',
    'orders': '/api/orders',
    'reviews': '/api/helper/reviews',
    'settlements': '/api/helpers/me/settlements',
  },
  requester: {
    'profile': '/api/requesters/business',
    'orders': '/api/requester/orders',
    'work-history': '/api/requester/orders',
    'reviews': '/api/requester/reviews',
    'refund-account': '/api/requesters/refund-account',
  },
  admin: {
    'profile': '/api/admin/users',
    'orders': '/api/admin/orders',
  },
};

export function getEndpointByRole(role: UserRole | undefined, feature: ApiFeature): string {
  const userRole = role || 'helper';
  const endpoint = ROLE_API_MAP[userRole]?.[feature];
  
  if (!endpoint) {
    console.warn(`No endpoint found for role "${userRole}" and feature "${feature}"`);
    return `/api/${feature}`;
  }
  
  return endpoint;
}

export function useRoleApi() {
  const { user } = useAuth();
  
  const getEndpoint = (feature: ApiFeature): string => {
    return getEndpointByRole(user?.role as UserRole, feature);
  };
  
  return { getEndpoint };
}
