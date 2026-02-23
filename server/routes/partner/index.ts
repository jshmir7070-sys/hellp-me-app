import type { RouteContext } from "../types";
import { registerPartnerAuthRoutes } from "./auth.routes";
import { registerPartnerDashboardRoutes } from "./dashboard.routes";
import { registerPartnerMemberRoutes } from "./members.routes";
import { registerPartnerOrderRoutes } from "./orders.routes";
import { registerPartnerSettlementRoutes } from "./settlement.routes";
import { registerPartnerCSRoutes } from "./cs.routes";
import { registerPartnerIncidentRoutes } from "./incidents.routes";
import { registerPartnerSettingsRoutes } from "./settings.routes";

export async function registerPartnerRoutes(ctx: RouteContext): Promise<void> {
  await registerPartnerAuthRoutes(ctx);
  await registerPartnerDashboardRoutes(ctx);
  await registerPartnerMemberRoutes(ctx);
  await registerPartnerOrderRoutes(ctx);
  await registerPartnerSettlementRoutes(ctx);
  await registerPartnerCSRoutes(ctx);
  await registerPartnerIncidentRoutes(ctx);
  await registerPartnerSettingsRoutes(ctx);
}
