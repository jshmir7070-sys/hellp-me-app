import { User, Order, Contract, IncidentReport, WorkSession, SettlementStatement, JobContract } from "../../shared/schema";

export function canReadOrder(user: User, order: Order): boolean {
  if (user.isHqStaff) return true;
  if (order.requesterId === user.id) return true;
  return false;
}

export function canWriteOrder(user: User, order: Order): boolean {
  if (user.isHqStaff) return true;
  if (order.requesterId === user.id) return true;
  return false;
}

export function canApplyToOrder(user: User, order: Order): boolean {
  if (user.role !== "helper") return false;
  if (user.onboardingStatus !== "approved") return false;
  if (order.requesterId === user.id) return false;
  return true;
}

export function canReadContract(user: User, contract: Contract): boolean {
  if (user.isHqStaff) return true;
  if (contract.requesterId === user.id) return true;
  if (contract.helperId === user.id) return true;
  return false;
}

export function canWriteContract(user: User, contract: Contract): boolean {
  if (user.isHqStaff) return true;
  if (contract.requesterId === user.id) return true;
  if (contract.helperId === user.id) return true;
  return false;
}

export function canReadIncident(user: User, incident: IncidentReport): boolean {
  if (user.isHqStaff) return true;
  if (incident.reporterId === user.id) return true;
  return false;
}

export function canWriteIncident(user: User, incident: IncidentReport): boolean {
  if (user.isHqStaff) return true;
  if (incident.reporterId === user.id) return true;
  return false;
}

export function canResolveIncident(user: User): boolean {
  return user.isHqStaff === true;
}

export function canReadWorkSession(user: User, session: WorkSession): boolean {
  if (user.isHqStaff) return true;
  if (session.helperId === user.id) return true;
  return false;
}

export function canWriteWorkSession(user: User, session: WorkSession): boolean {
  if (user.isHqStaff) return true;
  if (session.helperId === user.id) return true;
  return false;
}

export function canReadSettlement(user: User, statement: SettlementStatement): boolean {
  if (user.isHqStaff) return true;
  if (statement.helperId === user.id) return true;
  return false;
}

export function canWriteSettlement(user: User): boolean {
  return user.isHqStaff === true;
}

export function canConfirmSettlement(user: User, statement: SettlementStatement): boolean {
  if (statement.helperId === user.id) return true;
  return false;
}

export function canReadJobContract(user: User, contract: JobContract): boolean {
  if (user.isHqStaff) return true;
  if (contract.helperId === user.id) return true;
  return false;
}

export function canSignJobContract(user: User, contract: JobContract): boolean {
  if (contract.helperId === user.id) return true;
  return false;
}

export function canReadUserProfile(viewer: User, targetUserId: string): boolean {
  if (viewer.isHqStaff) return true;
  if (viewer.id === targetUserId) return true;
  return false;
}

export function canWriteUserProfile(viewer: User, targetUserId: string): boolean {
  if (viewer.id === targetUserId) return true;
  return false;
}

export function canManageTeam(user: User): boolean {
  return user.isTeamLeader === true || user.isHqStaff === true;
}

export function canAccessAdminPanel(user: User): boolean {
  return user.isHqStaff === true;
}

export function canManageCommissionPolicy(user: User): boolean {
  return user.isHqStaff === true;
}

export function canApproveHelper(user: User): boolean {
  return user.isHqStaff === true;
}

export function canViewAllOrders(user: User): boolean {
  return user.isHqStaff === true;
}

export function canViewAllHelpers(user: User): boolean {
  return user.isHqStaff === true;
}

export function canViewAllRequesters(user: User): boolean {
  return user.isHqStaff === true;
}

export function canViewAuditLogs(user: User): boolean {
  return user.isHqStaff === true;
}

export function canViewClientErrors(user: User): boolean {
  return user.isHqStaff === true;
}

export function canSendAnnouncement(user: User): boolean {
  return user.isHqStaff === true;
}
