import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../../storage";
import { EFFECTIVE_JWT_SECRET } from "../../config/jwt";

export interface PartnerRequest extends Request {
  partnerUser?: {
    id: string;
    email: string;
    name: string;
    role: string;
    isTeamLeader: boolean;
    [key: string]: any;
  };
  team?: {
    id: number;
    name: string;
    leaderId: string;
    qrCodeToken: string;
    commissionRate: number;
    isActive: boolean;
    [key: string]: any;
  };
}

export async function partnerAuth(req: PartnerRequest, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "인증이 필요합니다" });

    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET) as { userId: string };
    const user = await storage.getUser(decoded.userId);

    if (!user) return res.status(401).json({ message: "사용자를 찾을 수 없습니다" });
    if (!user.isTeamLeader) return res.status(403).json({ message: "파트너(팀장) 권한이 필요합니다" });

    // Find the team where this user is the leader
    const team = await storage.getTeamByLeader(user.id);
    if (team && !team.isActive) return res.status(403).json({ message: "비활성 팀입니다. 본사에 문의하세요." });

    if (!team) return res.status(403).json({ message: "활성 팀이 없습니다. 본사에 문의하세요." });

    req.partnerUser = user;
    req.team = team;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "토큰이 만료되었습니다" });
    }
    return res.status(401).json({ message: "인증에 실패했습니다" });
  }
}
