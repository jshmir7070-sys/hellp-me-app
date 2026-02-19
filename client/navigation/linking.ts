import * as Linking from 'expo-linking';
import { LinkingOptions } from '@react-navigation/native';

const linking: LinkingOptions<any> = {
    prefixes: [Linking.createURL('/'), 'hellpme://', 'https://hellpme.com'],
    config: {
        screens: {
            // Auth screens (top-level when not authenticated)
            Login: 'login',
            Signup: 'signup',
            FindEmail: 'find-email',
            FindPassword: 'find-password',
            // Root stack screens
            Main: {
                screens: {
                    HomeTab: 'home',
                    OrdersTab: 'orders',
                    CreateOrderTab: 'create-order',
                    WorkStatusTab: 'work-status',
                    SettlementTab: 'settlement',
                    ReviewsTab: 'reviews',
                    ProfileTab: 'profile',
                },
            },
            Modal: 'modal',
            QRScanner: 'qr-scanner',
            WorkProof: 'work-proof/:orderId',
            HelperOnboarding: 'helper-onboarding',
            ContractSigning: 'contract-signing',
            Payment: 'payment/:orderId',
            Contract: 'contract/:contractId',
            CreateContract: 'create-contract/:orderId',
            IdentityVerification: 'identity-verification',
        },
    },
};

export default linking;
