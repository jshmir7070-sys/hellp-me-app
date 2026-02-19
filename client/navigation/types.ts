export type JobsStackParamList = {
  JobList: undefined;
  JobDetail: { jobId: string };
  ClosingReport: { orderId: number };
  DisputeList: undefined;
  DisputeCreate: { orderId?: number; type?: string };
  DisputeDetail: { disputeId: number };
};
