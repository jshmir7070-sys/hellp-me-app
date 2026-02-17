import { NavigatorScreenParams } from "@react-navigation/native";
import { ClosingStackParamList } from "@/navigation/ClosingStackNavigator";

export type JobsStackParamList = {
  JobList: undefined;
  JobDetail: { jobId: string };
  ClosingReport: { orderId: number };
  DisputeList: undefined;
  DisputeCreate: { orderId?: number; type?: string };
  DisputeDetail: { disputeId: number };
};

export type MyJobsStackParamList = {
  MyJobs: undefined;
};

export type ContractsStackParamList = {
  Contracts: undefined;
  CreateJob: undefined;
  ContractDetail: { contractId: string };
  CreateContract: { orderId: number };
};

export type HomeStackParamList = {
  Home: undefined;
  RequesterClosing: undefined;
  ClosingDetail: { orderId: number };
  Payment: { orderId: number; type: 'deposit' | 'balance' };
};

export type ProfileStackParamList = {
  Profile: undefined;
  HelperHistory: undefined;
  RequesterHistory: undefined;
  HistoryDetail: { orderId: number; settlementId?: string };
  WriteReview: { orderId: number };
  RequesterDispute: { orderId: number };
  RequesterDisputeList: undefined;
  RequesterDisputeDetail: { disputeId: number };
  Disputes: undefined;
  DisputeCreate: { orderId?: number; type?: string };
  DisputeDetail: { disputeId: number };
  IncidentList: undefined;
  IncidentDetail: { incidentId: number };
  IncidentReport: { orderId: number };
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  OrdersTab: NavigatorScreenParams<JobsStackParamList> | undefined;
  CreateOrderTab: NavigatorScreenParams<ContractsStackParamList> | undefined;
  WorkStatusTab: NavigatorScreenParams<ClosingStackParamList> | undefined;
  RecruitmentTab: undefined;
  ReviewsTab: undefined;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Modal: undefined;
  QRScanner: { contractId?: string; type?: 'checkin'; orderId?: string };
  WorkProof: { orderId?: string; contractId?: string; type?: 'pickup' | 'delivery' | 'other' };
  HelperOnboarding: undefined;
  ContractSigning: undefined;
  Payment: { orderId?: string; contractId?: string; amount?: number; paymentType?: 'deposit' | 'balance'; orderTitle?: string };
  Contract: { contractId?: string; orderId?: string };
  CreateContract: { orderId: number };
  IdentityVerification: { returnScreen?: string; purpose?: 'signup' | 'profile' | 'payment' };
};
