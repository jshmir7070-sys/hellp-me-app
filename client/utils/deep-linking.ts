import * as Linking from 'expo-linking';
import { NavigationContainerRef } from '@react-navigation/native';

export type DeepLinkRoute = {
  screen: string;
  params?: Record<string, any>;
};

export function parseDeepLink(url: string): DeepLinkRoute | null {
  try {
    const parsed = Linking.parse(url);
    const { path, queryParams } = parsed;

    if (!path) {
      return null;
    }

    const pathParts = path.split('/').filter(Boolean);

    switch (pathParts[0]) {
      case 'order':
      case 'orders':
        if (pathParts[1]) {
          return {
            screen: 'JobDetail',
            params: { orderId: pathParts[1] },
          };
        }
        return { screen: 'JobList' };

      case 'contract':
      case 'contracts':
        if (pathParts[1]) {
          return {
            screen: 'Contract',
            params: { contractId: pathParts[1] },
          };
        }
        return { screen: 'Main', params: { screen: 'HomeTab' } };

      case 'notification':
      case 'notifications':
        return { screen: 'Notifications' };

      case 'settlement':
      case 'settlements':
        return { screen: 'SettlementHistory' };

      case 'profile':
        return { screen: 'Profile' };

      case 'checkin':
      case 'qr':
        return {
          screen: 'QRScanner',
          params: { type: 'checkin', ...(queryParams || {}) },
        };

      case 'payment':
        return {
          screen: 'Payment',
          params: queryParams || {},
        };

      case 'identity':
      case 'verify':
        return {
          screen: 'IdentityVerification',
          params: queryParams || {},
        };

      default:
        return null;
    }
  } catch (error) {
    console.error('Error parsing deep link:', error);
    return null;
  }
}

export function handleNotificationDeepLink(
  data: Record<string, any>,
  navigationRef: React.RefObject<NavigationContainerRef<any>>
): void {
  if (!navigationRef.current) {
    return;
  }

  const { type, relatedId, screen, params } = data;

  if (screen) {
    navigationRef.current.navigate(screen, params || {});
    return;
  }

  switch (type) {
    case 'matching_success':
    case 'matching_failed':
    case 'order_status':
      if (relatedId) {
        navigationRef.current.navigate('JobDetail', { orderId: relatedId });
      } else {
        navigationRef.current.navigate('Main', { screen: 'OrdersTab' });
      }
      break;

    case 'settlement_completed':
    case 'settlement_pending':
      navigationRef.current.navigate('SettlementHistory');
      break;

    case 'contract_signed':
    case 'contract_pending':
      if (relatedId) {
        navigationRef.current.navigate('Contract', { contractId: relatedId });
      } else {
        navigationRef.current.navigate('Main', { screen: 'HomeTab' });
      }
      break;

    case 'dispute_created':
    case 'dispute_resolved':
      navigationRef.current.navigate('Main', { screen: 'Profile' });
      break;

    case 'announcement':
    case 'system':
      navigationRef.current.navigate('Notifications');
      break;

    default:
      navigationRef.current.navigate('Notifications');
      break;
  }
}

export function getLinkingConfig() {
  return {
    prefixes: [
      Linking.createURL('/'),
      'hellpme://',
      'https://hellpme.app',
    ],
    config: {
      screens: {
        Main: {
          screens: {
            Home: 'home',
            Jobs: 'jobs',
            MyJobs: 'my-jobs',
            Profile: 'profile',
            Notifications: 'notifications',
          },
        },
        JobDetail: 'order/:orderId',
        Contract: 'contract/:contractId',
        Payment: 'payment',
        QRScanner: 'qr',
        IdentityVerification: 'verify',
        SettlementHistory: 'settlements',
      },
    },
  };
}
