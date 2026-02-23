import { Router } from "express";
import type { RouteContext } from "../types";
import { partnerAuth, PartnerRequest } from "./middleware";

export async function registerPartnerSettingsRoutes(ctx: RouteContext): Promise<void> {
  const { app, storage } = ctx;
  const router = Router();

  // GET /api/partner/settings - 팀 정보 조회
  router.get("/", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const teamData = await storage.getTeam(team.id);
      if (!teamData) {
        return res.status(404).json({ message: "팀을 찾을 수 없습니다" });
      }

      const members = await storage.getTeamMembers(team.id);
      const activeMembers = members.filter((m: any) => m.isActive);

      const leader = await storage.getUser(teamData.leaderId);

      res.json({
        team: {
          id: teamData.id,
          name: teamData.name,
          businessType: teamData.businessType,
          emergencyPhone: teamData.emergencyPhone,
          commissionRate: teamData.commissionRate,
          qrCodeToken: teamData.qrCodeToken,
          isActive: teamData.isActive,
          createdAt: teamData.createdAt,
        },
        leader: leader ? {
          id: leader.id,
          name: leader.name,
          email: leader.email,
          phoneNumber: leader.phoneNumber,
        } : null,
        stats: {
          totalMembers: members.length,
          activeMembers: activeMembers.length,
          inactiveMembers: members.length - activeMembers.length,
        },
      });
    } catch (error) {
      console.error("[Partner Settings] Error:", error);
      res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  router.patch("/", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const team = req.team!;
      const { emergencyPhone, businessType } = req.body;

      const updates: any = {};
      if (emergencyPhone !== undefined) updates.emergencyPhone = emergencyPhone;
      if (businessType !== undefined) updates.businessType = businessType;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "수정할 항목이 없습니다" });
      }

      const updated = await storage.updateTeam(team.id, updates);
      res.json({ team: updated, message: "설정이 저장되었습니다" });
    } catch (error) {
      console.error("[Partner Settings] Update error:", error);
      res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  app.use("/api/partner/settings", router);
}
