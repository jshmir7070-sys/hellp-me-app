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
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  Modal: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  CreateOrderTab: undefined;
  WorkStatusTab: undefined;
  RecruitmentTab: undefined;
  ReviewsTab: undefined;
  ProfileTab: undefined;
};
