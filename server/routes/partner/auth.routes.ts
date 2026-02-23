import type { RouteContext } from "../types";
import type { PartnerRequest } from "./middleware";
import { partnerAuth } from "./middleware";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { EFFECTIVE_JWT_SECRET } from "../../config/jwt";

export async function registerPartnerAuthRoutes(ctx: RouteContext): Promise<void> {
  const { app, storage, strictRateLimiter } = ctx;

  // POST /api/partner/auth/login
  app.post("/api/partner/auth/login", strictRateLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "이메일과 비밀번호를 입력해주세요" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다" });

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다" });

      if (!user.isTeamLeader) {
        return res.status(403).json({ message: "파트너(팀장) 계정이 아닙니다" });
      }

      // Find the team
      const team = await storage.getTeamByLeader(user.id);

      if (!team) {
        return res.status(403).json({ message: "활성 팀이 없습니다. 본사에 문의하세요." });
      }

      const token = jwt.sign(
        { userId: user.id },
        EFFECTIVE_JWT_SECRET,
        { expiresIn: "7d" }
      );

      const { password: _, ...safeUser } = user;
      res.json({
        token,
        user: safeUser,
        team: {
          id: team.id,
          name: team.name,
          commissionRate: team.commissionRate,
          businessType: team.businessType,
        },
      });
    } catch (error) {
      console.error("[Partner Auth] Login error:", error);
      res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  // GET /api/partner/auth/me
  app.get("/api/partner/auth/me", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const user = req.partnerUser!;
      const team = req.team!;

      const { password: _, ...safeUser } = user as any;
      res.json({
        user: safeUser,
        team: {
          id: team.id,
          name: team.name,
          commissionRate: team.commissionRate,
          businessType: (team as any).businessType,
        },
      });
    } catch (error) {
      console.error("[Partner Auth] Me error:", error);
      res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  // POST /api/partner/auth/change-password
  app.post("/api/partner/auth/change-password", partnerAuth, async (req: PartnerRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = req.partnerUser!;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "현재 비밀번호와 새 비밀번호를 입력해주세요" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "비밀번호는 8자 이상이어야 합니다" });
      }

      const fullUser = await storage.getUser(user.id);
      const isValid = await bcrypt.compare(currentPassword, fullUser.password);
      if (!isValid) {
        return res.status(401).json({ message: "현재 비밀번호가 올바르지 않습니다" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { password: hashedPassword });

      res.json({ message: "비밀번호가 변경되었습니다" });
    } catch (error) {
      console.error("[Partner Auth] Change password error:", error);
      res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });
}
