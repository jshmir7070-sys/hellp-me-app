import type { RouteContext } from "../types";
import type { PartnerRequest } from "./middleware";
import { partnerAuth } from "./middleware";

export async function registerPartnerDashboardRoutes(ctx: RouteContext): Promise<void> {
  const { app, storage, db, tables, eq, and, inArray } = ctx;

  // GET /api/partner/dashboard
  app.get("/api/partner/dashboard", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;

      // Get team members
      const members = await storage.getTeamMembers(team.id);
      const activeMembers = members.filter((m: any) => m.isActive);
      const memberIds = activeMembers.map((m: any) => m.helperId);

      // Count active orders (matching, scheduled, in_progress)
      let activeOrderCount = 0;
      if (memberIds.length > 0) {
        const orders = await db.select()
          .from(tables.orders)
          .where(
            and(
              inArray(tables.orders.matchedHelperId, memberIds),
              inArray(tables.orders.status, ['matching', 'scheduled', 'in_progress', 'closing_submitted'])
            )
          );
        activeOrderCount = orders.length;
      }

      // Monthly settlement (simplified - just count settlements for current month)
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      let monthlySettlement = 0;
      // Try to get team incentive for current month
      try {
        const incentives = await db.select()
          .from(tables.teamIncentives)
          .where(
            and(
              eq(tables.teamIncentives.teamId, team.id),
              eq(tables.teamIncentives.period, currentMonth)
            )
          );
        if (incentives.length > 0) {
          monthlySettlement = incentives[0].totalFees || 0;
        }
      } catch (e) {
        // Table may not exist yet
      }

      res.json({
        teamName: team.name,
        memberCount: activeMembers.length,
        activeOrderCount,
        monthlySettlement,
        currentMonth,
      });
    } catch (error) {
      console.error("[Partner Dashboard] Error:", error);
      res.status(500).json({ message: "대시보드 데이터를 불러오는데 실패했습니다" });
    }
  });
}
