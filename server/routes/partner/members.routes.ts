import type { RouteContext } from "../types";
import type { PartnerRequest } from "./middleware";
import { partnerAuth } from "./middleware";

export async function registerPartnerMemberRoutes(ctx: RouteContext): Promise<void> {
  const { app, storage, db, tables, eq, and, desc } = ctx;

  // GET /api/partner/members - List team members
  app.get("/api/partner/members", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const members = await storage.getTeamMembers(team.id);

      // Enrich with user details
      const enrichedMembers = await Promise.all(
        members.map(async (member: any) => {
          try {
            const user = await storage.getUser(member.helperId);
            return {
              id: member.id,
              helperId: member.helperId,
              isActive: member.isActive,
              joinedAt: member.joinedAt,
              user: user ? {
                id: user.id,
                name: user.name,
                phone: user.phoneNumber,
                email: user.email,
                profileImageUrl: user.profileImageUrl,
                onboardingStatus: user.onboardingStatus,
                helperVerified: user.helperVerified,
              } : null,
            };
          } catch {
            return {
              ...member,
              user: null,
            };
          }
        })
      );

      res.json({
        members: enrichedMembers,
        teamName: team.name,
        inviteCode: team.qrCodeToken,
      });
    } catch (error) {
      console.error("[Partner Members] List error:", error);
      res.status(500).json({ message: "팀원 목록을 불러오는데 실패했습니다" });
    }
  });

  // GET /api/partner/members/:memberId - Member detail
  app.get("/api/partner/members/:memberId", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const memberId = parseInt(req.params.memberId);

      if (isNaN(memberId)) {
        return res.status(400).json({ message: "잘못된 팀원 ID입니다" });
      }

      const members = await storage.getTeamMembers(team.id);
      const member = members.find((m: any) => m.id === memberId);

      if (!member) {
        return res.status(404).json({ message: "팀원을 찾을 수 없습니다" });
      }

      const user = await storage.getUser(member.helperId);

      // Get recent orders for this member
      let recentOrders: any[] = [];
      try {
        const orders = await db.select()
          .from(tables.orders)
          .where(eq(tables.orders.matchedHelperId, member.helperId))
          .orderBy(desc(tables.orders.createdAt))
          .limit(10);
        recentOrders = orders;
      } catch (e) {
        // Ignore - table may not be accessible
      }

      res.json({
        member: {
          id: member.id,
          helperId: member.helperId,
          isActive: member.isActive,
          joinedAt: member.joinedAt,
        },
        user: user ? {
          id: user.id,
          name: user.name,
          phone: user.phoneNumber,
          email: user.email,
          profileImageUrl: user.profileImageUrl,
          onboardingStatus: user.onboardingStatus,
          helperVerified: user.helperVerified,
        } : null,
        recentOrders,
      });
    } catch (error) {
      console.error("[Partner Members] Detail error:", error);
      res.status(500).json({ message: "팀원 상세를 불러오는데 실패했습니다" });
    }
  });

  // POST /api/partner/members/invite - Generate/get invite code
  app.post("/api/partner/members/invite", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;

      // Return existing QR token
      res.json({
        inviteCode: team.qrCodeToken,
        teamName: team.name,
        teamId: team.id,
      });
    } catch (error) {
      console.error("[Partner Members] Invite error:", error);
      res.status(500).json({ message: "초대 코드를 생성하는데 실패했습니다" });
    }
  });

  // DELETE /api/partner/members/:memberId - Remove member (deactivate)
  app.delete("/api/partner/members/:memberId", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const memberId = parseInt(req.params.memberId);

      if (isNaN(memberId)) {
        return res.status(400).json({ message: "잘못된 팀원 ID입니다" });
      }

      const members = await storage.getTeamMembers(team.id);
      const member = members.find((m: any) => m.id === memberId);

      if (!member) {
        return res.status(404).json({ message: "팀원을 찾을 수 없습니다" });
      }

      // Deactivate member
      await db.update(tables.teamMembers)
        .set({ isActive: false })
        .where(eq(tables.teamMembers.id, memberId));

      res.json({ message: "팀원이 제거되었습니다" });
    } catch (error) {
      console.error("[Partner Members] Remove error:", error);
      res.status(500).json({ message: "팀원 제거에 실패했습니다" });
    }
  });
}
