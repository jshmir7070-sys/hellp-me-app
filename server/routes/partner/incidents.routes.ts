import type { RouteContext } from "../types";
import type { PartnerRequest } from "./middleware";
import { partnerAuth } from "./middleware";

export async function registerPartnerIncidentRoutes(ctx: RouteContext): Promise<void> {
  const { app, storage, db, tables, eq, and, desc } = ctx;

  // GET /api/partner/incidents - List team incidents
  app.get("/api/partner/incidents", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const { status, page = '1', limit = '20' } = req.query as any;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      const conditions: any[] = [eq(tables.teamIncidents.teamId, team.id)];
      if (status) {
        conditions.push(eq(tables.teamIncidents.status, status));
      }

      const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

      const incidents = await db.select()
        .from(tables.teamIncidents)
        .where(whereClause)
        .orderBy(desc(tables.teamIncidents.createdAt))
        .limit(limitNum)
        .offset(offset);

      // Enrich with helper names
      const enriched = await Promise.all(
        incidents.map(async (inc: any) => {
          let helperName = '알 수 없음';
          try {
            const user = await storage.getUser(inc.helperId);
            helperName = user?.name || '알 수 없음';
          } catch {}
          return { ...inc, helperName };
        })
      );

      const countResult = await db.select({ count: ctx.sql`count(*)::int` })
        .from(tables.teamIncidents)
        .where(whereClause);

      const total = countResult[0]?.count || 0;

      res.json({
        incidents: enriched,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (error) {
      console.error("[Partner Incidents] List error:", error);
      res.status(500).json({ message: "사고 목록을 불러오는데 실패했습니다" });
    }
  });

  // POST /api/partner/incidents - Create incident
  app.post("/api/partner/incidents", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const { helperId, orderId, incidentType, description, severity } = req.body;

      if (!helperId || !description) {
        return res.status(400).json({ message: "헬퍼와 사고 내용을 입력해주세요" });
      }

      // Verify helper is a team member
      const members = await storage.getTeamMembers(team.id);
      const isMember = members.some((m: any) => m.helperId === helperId && m.isActive);
      if (!isMember) {
        return res.status(400).json({ message: "해당 헬퍼는 팀원이 아닙니다" });
      }

      const [incident] = await db.insert(tables.teamIncidents).values({
        teamId: team.id,
        helperId,
        orderId: orderId ? parseInt(orderId) : null,
        incidentType: incidentType || 'other',
        description,
        severity: severity || 'medium',
      }).returning();

      res.status(201).json(incident);
    } catch (error) {
      console.error("[Partner Incidents] Create error:", error);
      res.status(500).json({ message: "사고 보고를 생성하는데 실패했습니다" });
    }
  });

  // GET /api/partner/incidents/:id - Incident detail
  app.get("/api/partner/incidents/:id", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const id = parseInt(req.params.id);

      if (isNaN(id)) return res.status(400).json({ message: "잘못된 ID입니다" });

      const [incident] = await db.select()
        .from(tables.teamIncidents)
        .where(and(eq(tables.teamIncidents.id, id), eq(tables.teamIncidents.teamId, team.id)));

      if (!incident) return res.status(404).json({ message: "사고를 찾을 수 없습니다" });

      // Get helper info
      let helperName = '알 수 없음';
      try {
        const user = await storage.getUser(incident.helperId);
        helperName = user?.name || '알 수 없음';
      } catch {}

      res.json({ ...incident, helperName });
    } catch (error) {
      console.error("[Partner Incidents] Detail error:", error);
      res.status(500).json({ message: "사고 상세를 불러오는데 실패했습니다" });
    }
  });

  // PATCH /api/partner/incidents/:id - Update incident (team leader note)
  app.patch("/api/partner/incidents/:id", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const id = parseInt(req.params.id);
      const { teamLeaderNote, status } = req.body;

      if (isNaN(id)) return res.status(400).json({ message: "잘못된 ID입니다" });

      const [existing] = await db.select()
        .from(tables.teamIncidents)
        .where(and(eq(tables.teamIncidents.id, id), eq(tables.teamIncidents.teamId, team.id)));

      if (!existing) return res.status(404).json({ message: "사고를 찾을 수 없습니다" });

      const updateData: any = { updatedAt: new Date() };
      if (teamLeaderNote !== undefined) updateData.teamLeaderNote = teamLeaderNote;
      if (status) updateData.status = status;
      if (status === 'resolved') updateData.resolvedAt = new Date();

      const [updated] = await db.update(tables.teamIncidents)
        .set(updateData)
        .where(eq(tables.teamIncidents.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("[Partner Incidents] Update error:", error);
      res.status(500).json({ message: "사고를 수정하는데 실패했습니다" });
    }
  });
}
