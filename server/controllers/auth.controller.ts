/**
 * Authentication Controller
 * Handles HTTP requests/responses for authentication
 */

import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import type { AuthenticatedRequest } from '../utils/auth-middleware';
import { authAuditLogs } from '@shared/schema';
import { db } from '../storage';
import { randomUUID } from 'crypto';

/**
 * Log authentication events for audit
 */
async function logAuthEvent(
  req: Request,
  eventType: string,
  status: 'success' | 'failure' | 'pending',
  options: { userId?: string | null; provider?: string; metadata?: Record<string, unknown> } = {}
) {
  try {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const requestId = (req as any).requestId || randomUUID().slice(0, 8);

    await db.insert(authAuditLogs).values({
      userId: options.userId || null,
      eventType,
      provider: options.provider || null,
      status,
      ipAddress,
      userAgent,
      requestId,
      metadata: options.metadata ? JSON.stringify(options.metadata) : null,
    });
  } catch (err) {
    console.error('[AuthAudit] Failed to log event:', err);
  }
}

export class AuthController {
  /**
   * POST /api/auth/signup
   */
  async signup(req: Request, res: Response) {
    try {
      const { email, password, name, phone, role } = req.body;

      const user = await authService.signup({ email, password, name, phone, role });

      await logAuthEvent(req, 'signup', 'success', { userId: user.id });

      res.json({
        success: true,
        user,
      });
    } catch (error: any) {
      await logAuthEvent(req, 'signup_failed', 'failure', {
        metadata: { error: error.message },
      });

      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const result = await authService.login({ email, password });

      await logAuthEvent(req, 'login', 'success', { userId: result.user.id });

      res.json({
        success: true,
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });
    } catch (error: any) {
      await logAuthEvent(req, 'login_failed', 'failure', {
        metadata: { email: req.body.email },
      });

      res.status(401).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/auth/refresh
   */
  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token is required',
        });
      }

      const tokens = await authService.refreshToken(refreshToken);

      res.json({
        success: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response) {
    try {
      // In a real implementation, you might want to blacklist the token
      // For now, we just return success
      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/auth/me
   */
  async getMe(req: AuthenticatedRequest, res: Response) {
    try {
      res.json({
        success: true,
        user: req.user,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/auth/check-email
   */
  async checkEmail(req: Request, res: Response) {
    try {
      const { email } = req.body;
      const exists = await authService.checkEmailExists(email);

      res.json({
        success: true,
        exists,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/auth/find-email
   */
  async findEmail(req: Request, res: Response) {
    try {
      const { phone } = req.body;
      const email = await authService.findEmailByPhone(phone);

      if (!email) {
        return res.status(404).json({
          success: false,
          error: 'No account found with this phone number',
        });
      }

      res.json({
        success: true,
        email,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/auth/reset-password
   */
  async resetPassword(req: Request, res: Response) {
    try {
      const { email, phone, newPassword } = req.body;

      await authService.resetPassword({ email, phone, newPassword });

      await logAuthEvent(req, 'password_reset', 'success', {
        metadata: { email },
      });

      res.json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/auth/change-password
   */
  async changePassword(req: AuthenticatedRequest, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body;

      await authService.changePassword(req.user.id, currentPassword, newPassword);

      await logAuthEvent(req, 'password_change', 'success', { userId: req.user.id });

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/auth/update-role
   */
  async updateRole(req: AuthenticatedRequest, res: Response) {
    try {
      const { newRole } = req.body;

      await authService.updateRole(req.user.id, newRole);

      res.json({
        success: true,
        message: 'Role updated successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * DELETE /api/auth/delete-account
   */
  async deleteAccount(req: AuthenticatedRequest, res: Response) {
    try {
      await authService.deleteAccount(req.user.id);

      await logAuthEvent(req, 'account_deleted', 'success', { userId: req.user.id });

      res.json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/auth/withdraw
   */
  async withdraw(req: AuthenticatedRequest, res: Response) {
    try {
      await authService.deleteAccount(req.user.id);

      res.json({
        success: true,
        message: 'Account withdrawn successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

// Export singleton instance
export const authController = new AuthController();
