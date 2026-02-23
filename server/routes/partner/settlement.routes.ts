import type { RouteContext } from "../types";
import type { PartnerRequest } from "./middleware";
import { partnerAuth } from "./middleware";

export async function registerPartnerSettlementRoutes(ctx: RouteContext): Promise<void> {
  const { app, storage, db, tables, eq, and, inArray, desc, sql } = ctx;

  // GET /api/partner/settlements - Monthly settlement by team members
  app.get("/api/partner/settlements", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const { month } = req.query as { month?: string };

      // Default to current month
      const now = new Date();
      const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Get team members
      const members = await storage.getTeamMembers(team.id);
      const activeMembers = members.filter((m: any) => m.isActive);
      const memberIds = activeMembers.map((m: any) => m.helperId);

      if (memberIds.length === 0) {
        return res.json({ settlements: [], summary: { totalAmount: 0, totalCommission: 0, totalPayout: 0, platformCommission: 0 }, month: targetMonth });
      }

      // Get settlement statements for team members
      let settlements: any[] = [];
      try {
        settlements = await db.select()
          .from(tables.settlementStatements)
          .where(
            and(
              inArray(tables.settlementStatements.helperId, memberIds),
              eq(tables.settlementStatements.period, targetMonth)
            )
          )
          .orderBy(desc(tables.settlementStatements.createdAt));
      } catch (e) {
        // Table may not have data
      }

      // Enrich with helper names
      const memberMap = new Map(activeMembers.map((m: any) => [m.helperId, m]));
      const enrichedSettlements = await Promise.all(
        settlements.map(async (s: any) => {
          const member = memberMap.get(s.helperId);
          let helperName = '알 수 없음';
          if (member) {
            try {
              const user = await storage.getUser(s.helperId);
              helperName = user?.name || '알 수 없음';
            } catch {}
          }
          return { ...s, helperName };
        })
      );

      // Calculate summary
      const summary = {
        totalAmount: settlements.reduce((sum: number, s: any) => sum + (s.totalContractAmount || 0), 0),
        totalCommission: settlements.reduce((sum: number, s: any) => sum + (s.commissionAmount || 0), 0),
        totalPayout: settlements.reduce((sum: number, s: any) => sum + (s.helperPayout || 0), 0),
        platformCommission: settlements.reduce((sum: number, s: any) => sum + (s.platformCommission || 0), 0),
      };

      // Get team incentive for the month
      let teamIncentive = null;
      try {
        const incentives = await db.select()
          .from(tables.teamIncentives)
          .where(
            and(
              eq(tables.teamIncentives.teamId, team.id),
              eq(tables.teamIncentives.period, targetMonth)
            )
          );
        if (incentives.length > 0) {
          teamIncentive = incentives[0];
        }
      } catch (e) {}

      res.json({
        settlements: enrichedSettlements,
        summary,
        teamIncentive,
        month: targetMonth,
        teamCommissionRate: team.commissionRate,
      });
    } catch (error) {
      console.error("[Partner Settlement] List error:", error);
      res.status(500).json({ message: "정산 데이터를 불러오는데 실패했습니다" });
    }
  });

  // GET /api/partner/settlements/summary - Monthly aggregate
  app.get("/api/partner/settlements/summary", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;

      // Get last 6 months of data
      const months: string[] = [];
      const now = new Date();
      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }

      const members = await storage.getTeamMembers(team.id);
      const memberIds = members.filter((m: any) => m.isActive).map((m: any) => m.helperId);

      const monthlySummaries = await Promise.all(
        months.map(async (month) => {
          let totalAmount = 0;
          let totalCommission = 0;
          let count = 0;

          if (memberIds.length > 0) {
            try {
              const settlements = await db.select()
                .from(tables.settlementStatements)
                .where(
                  and(
                    inArray(tables.settlementStatements.helperId, memberIds),
                    eq(tables.settlementStatements.period, month)
                  )
                );
              totalAmount = settlements.reduce((sum: number, s: any) => sum + (s.totalContractAmount || 0), 0);
              totalCommission = settlements.reduce((sum: number, s: any) => sum + (s.commissionAmount || 0), 0);
              count = settlements.length;
            } catch {}
          }

          return { month, totalAmount, totalCommission, count };
        })
      );

      res.json({ monthlySummaries });
    } catch (error) {
      console.error("[Partner Settlement] Summary error:", error);
      res.status(500).json({ message: "정산 요약을 불러오는데 실패했습니다" });
    }
  });
}
