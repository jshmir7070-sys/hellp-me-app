import type { RouteContext } from "../types";
import type { PartnerRequest } from "./middleware";
import { partnerAuth } from "./middleware";

export async function registerPartnerCSRoutes(ctx: RouteContext): Promise<void> {
  const { app, db, tables, eq, and, desc } = ctx;

  // GET /api/partner/cs - List team CS inquiries
  app.get("/api/partner/cs", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const { status, page = '1', limit = '20' } = req.query as any;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      const conditions: any[] = [eq(tables.teamCsInquiries.teamId, team.id)];
      if (status) {
        conditions.push(eq(tables.teamCsInquiries.status, status));
      }

      const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

      const inquiries = await db.select()
        .from(tables.teamCsInquiries)
        .where(whereClause)
        .orderBy(desc(tables.teamCsInquiries.createdAt))
        .limit(limitNum)
        .offset(offset);

      const countResult = await db.select({ count: ctx.sql`count(*)::int` })
        .from(tables.teamCsInquiries)
        .where(whereClause);

      const total = countResult[0]?.count || 0;

      res.json({
        inquiries,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (error) {
      console.error("[Partner CS] List error:", error);
      res.status(500).json({ message: "CS 목록을 불러오는데 실패했습니다" });
    }
  });

  // POST /api/partner/cs - Create CS inquiry
  app.post("/api/partner/cs", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const user = req.partnerUser!;
      const { title, content, category, priority, orderId } = req.body;

      if (!title || !content) {
        return res.status(400).json({ message: "제목과 내용을 입력해주세요" });
      }

      const [inquiry] = await db.insert(tables.teamCsInquiries).values({
        teamId: team.id,
        reporterId: user.id,
        title,
        content,
        category: category || 'other',
        priority: priority || 'normal',
        orderId: orderId ? parseInt(orderId) : null,
      }).returning();

      res.status(201).json(inquiry);
    } catch (error) {
      console.error("[Partner CS] Create error:", error);
      res.status(500).json({ message: "CS 문의를 생성하는데 실패했습니다" });
    }
  });

  // GET /api/partner/cs/:id - CS detail
  app.get("/api/partner/cs/:id", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const id = parseInt(req.params.id);

      if (isNaN(id)) return res.status(400).json({ message: "잘못된 ID입니다" });

      const [inquiry] = await db.select()
        .from(tables.teamCsInquiries)
        .where(and(eq(tables.teamCsInquiries.id, id), eq(tables.teamCsInquiries.teamId, team.id)));

      if (!inquiry) return res.status(404).json({ message: "문의를 찾을 수 없습니다" });

      res.json(inquiry);
    } catch (error) {
      console.error("[Partner CS] Detail error:", error);
      res.status(500).json({ message: "CS 상세를 불러오는데 실패했습니다" });
    }
  });

  // PATCH /api/partner/cs/:id - Update CS inquiry (partner can add notes)
  app.patch("/api/partner/cs/:id", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const id = parseInt(req.params.id);
      const { content, priority } = req.body;

      if (isNaN(id)) return res.status(400).json({ message: "잘못된 ID입니다" });

      // Verify ownership
      const [existing] = await db.select()
        .from(tables.teamCsInquiries)
        .where(and(eq(tables.teamCsInquiries.id, id), eq(tables.teamCsInquiries.teamId, team.id)));

      if (!existing) return res.status(404).json({ message: "문의를 찾을 수 없습니다" });

      const updateData: any = { updatedAt: new Date() };
      if (content) updateData.content = content;
      if (priority) updateData.priority = priority;

      const [updated] = await db.update(tables.teamCsInquiries)
        .set(updateData)
        .where(eq(tables.teamCsInquiries.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("[Partner CS] Update error:", error);
      res.status(500).json({ message: "CS 문의를 수정하는데 실패했습니다" });
    }
  });
}
