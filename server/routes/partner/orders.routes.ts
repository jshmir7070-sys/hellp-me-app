import type { RouteContext } from "../types";
import type { PartnerRequest } from "./middleware";
import { partnerAuth } from "./middleware";

export async function registerPartnerOrderRoutes(ctx: RouteContext): Promise<void> {
  const { app, storage, db, tables, eq, and, inArray, desc, gte, lte } = ctx;

  // GET /api/partner/orders - List team orders
  app.get("/api/partner/orders", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const { status, helperId, startDate, endDate, page = '1', limit = '20' } = req.query as any;

      // Get team members
      const members = await storage.getTeamMembers(team.id);
      const activeMembers = members.filter((m: any) => m.isActive);
      const memberIds = activeMembers.map((m: any) => m.helperId);

      if (memberIds.length === 0) {
        return res.json({ orders: [], total: 0, page: 1, totalPages: 0 });
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      // Build conditions
      const conditions: any[] = [];

      // Filter: orders matched to team members OR orders available for matching
      if (helperId && memberIds.includes(helperId)) {
        conditions.push(eq(tables.orders.matchedHelperId, helperId));
      } else {
        conditions.push(inArray(tables.orders.matchedHelperId, memberIds));
      }

      if (status) {
        if (Array.isArray(status)) {
          conditions.push(inArray(tables.orders.status, status));
        } else {
          conditions.push(eq(tables.orders.status, status));
        }
      }

      if (startDate) {
        conditions.push(gte(tables.orders.createdAt, new Date(startDate)));
      }
      if (endDate) {
        conditions.push(lte(tables.orders.createdAt, new Date(endDate)));
      }

      const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

      // Get orders
      const orders = await db.select()
        .from(tables.orders)
        .where(whereClause)
        .orderBy(desc(tables.orders.createdAt))
        .limit(limitNum)
        .offset(offset);

      // Get total count
      const countResult = await db.select({ count: ctx.sql`count(*)::int` })
        .from(tables.orders)
        .where(whereClause);

      const total = countResult[0]?.count || 0;

      // Enrich with helper info
      const enrichedOrders = await Promise.all(orders.map(async (order: any) => {
        const member = activeMembers.find((m: any) => m.helperId === order.matchedHelperId);
        let helperName = null;
        if (member) {
          try {
            const helperUser = await storage.getUser(member.helperId);
            helperName = helperUser?.name || null;
          } catch {}
        }
        return {
          ...order,
          helperName,
        };
      }));

      res.json({
        orders: enrichedOrders,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (error) {
      console.error("[Partner Orders] List error:", error);
      res.status(500).json({ message: "오더 목록을 불러오는데 실패했습니다" });
    }
  });

  // GET /api/partner/orders/available - List matching orders where team members have applied
  app.get("/api/partner/orders/available", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const members = await storage.getTeamMembers(team.id);
      const memberIds = members.filter((m: any) => m.isActive).map((m: any) => m.helperId);

      if (memberIds.length === 0) {
        return res.json({ orders: [] });
      }

      // Only return matching orders where team members have applied
      const orders = await db.select()
        .from(tables.orders)
        .where(and(
          eq(tables.orders.status, 'matching'),
        ))
        .orderBy(desc(tables.orders.createdAt))
        .limit(50);

      // Filter to orders where at least one team member has applied
      const filteredOrders = [];
      for (const order of orders) {
        const applications = await storage.getOrderApplications(order.id);
        const hasTeamApplication = applications.some((a: any) => memberIds.includes(a.helperUserId));
        if (hasTeamApplication) {
          filteredOrders.push(order);
        }
      }

      res.json({ orders: filteredOrders });
    } catch (error) {
      console.error("[Partner Orders] Available error:", error);
      res.status(500).json({ message: "매칭 가능 오더를 불러오는데 실패했습니다" });
    }
  });

  // GET /api/partner/orders/:orderId - Order detail
  app.get("/api/partner/orders/:orderId", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const orderId = parseInt(req.params.orderId);

      if (isNaN(orderId)) {
        return res.status(400).json({ message: "잘못된 오더 ID입니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // Verify this order involves a team member
      const members = await storage.getTeamMembers(team.id);
      const memberIds = members.filter((m: any) => m.isActive).map((m: any) => m.helperId);

      if (!order.matchedHelperId || !memberIds.includes(order.matchedHelperId)) {
        return res.status(403).json({ message: "팀 오더가 아닙니다" });
      }

      // Get applications
      const applications = await storage.getOrderApplications(orderId);

      res.json({ order, applications });
    } catch (error) {
      console.error("[Partner Orders] Detail error:", error);
      res.status(500).json({ message: "오더 상세를 불러오는데 실패했습니다" });
    }
  });

  // POST /api/partner/orders/:orderId/assign - Assign team member to matching order
  app.post("/api/partner/orders/:orderId/assign", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const orderId = parseInt(req.params.orderId);
      const { helperId } = req.body;

      if (isNaN(orderId)) {
        return res.status(400).json({ message: "잘못된 오더 ID입니다" });
      }
      if (!helperId) {
        return res.status(400).json({ message: "배정할 헬퍼를 선택해주세요" });
      }

      // Verify order exists and is in matching status
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }
      if (order.status !== 'matching') {
        return res.status(400).json({ message: "매칭 상태가 아닌 오더입니다. 현재 상태: " + order.status });
      }

      // Verify helperId is an active team member
      const members = await storage.getTeamMembers(team.id);
      const activeMember = members.find((m: any) => m.helperId === helperId && m.isActive);
      if (!activeMember) {
        return res.status(400).json({ message: "해당 헬퍼는 팀원이 아닙니다" });
      }

      // Create application and assign
      try {
        await storage.createOrderApplication({
          orderId,
          helperId,
          status: 'approved',
          message: `팀장 배정 (${team.name})`,
        });
      } catch (e) {
        // Application may already exist, continue to update matchedHelperId
      }

      // Update order with matched helper
      await storage.updateOrder(orderId, {
        matchedHelperId: helperId,
        status: 'scheduled',
      });

      res.json({ message: "팀원이 배정되었습니다", orderId, helperId });
    } catch (error) {
      console.error("[Partner Orders] Assign error:", error);
      res.status(500).json({ message: "팀원 배정에 실패했습니다" });
    }
  });
}
