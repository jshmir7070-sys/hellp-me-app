/**
 * Authentication Routes
 * All /api/auth/* endpoints
 */

import type { Express } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../utils/auth-middleware';
import { validateBody, authSchemas } from '../utils/validation';
import {
  authRateLimiter,
  signupRateLimiter,
  passwordResetRateLimiter,
  strictRateLimiter,
} from '../utils/rate-limiter';
import { api } from '@shared/routes';

export function registerAuthRoutes(app: Express) {
  // ==================== Basic Auth ====================

  /**
   * POST /api/auth/signup
   * Register a new user
   */
  app.post(
    api.auth.signup.path,
    signupRateLimiter,
    authController.signup.bind(authController)
  );

  /**
   * POST /api/auth/login
   * Login with email and password
   */
  app.post(
    api.auth.login.path,
    authRateLimiter,
    authController.login.bind(authController)
  );

  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  app.post('/api/auth/refresh', authController.refreshToken.bind(authController));

  /**
   * POST /api/auth/logout
   * Logout current user
   */
  app.post('/api/auth/logout', authController.logout.bind(authController));

  /**
   * GET /api/auth/me
   * Get current authenticated user
   */
  app.get(
    api.auth.me.path,
    requireAuth,
    authController.getMe.bind(authController)
  );

  // ==================== Email & Password ====================

  /**
   * POST /api/auth/check-email
   * Check if email already exists
   */
  app.post(
    api.auth.checkEmail.path,
    authController.checkEmail.bind(authController)
  );

  /**
   * POST /api/auth/find-email
   * Find email by phone number
   */
  app.post(
    '/api/auth/find-email',
    validateBody(authSchemas.findEmail),
    authController.findEmail.bind(authController)
  );

  /**
   * POST /api/auth/reset-password
   * Reset password (forgot password)
   */
  app.post(
    '/api/auth/reset-password',
    passwordResetRateLimiter,
    validateBody(authSchemas.resetPassword),
    authController.resetPassword.bind(authController)
  );

  /**
   * POST /api/auth/change-password
   * Change password (authenticated user)
   */
  app.post(
    '/api/auth/change-password',
    requireAuth,
    authController.changePassword.bind(authController)
  );

  // ==================== Account Management ====================

  /**
   * POST /api/auth/update-role
   * Update user role
   */
  app.post(
    '/api/auth/update-role',
    requireAuth,
    authController.updateRole.bind(authController)
  );

  /**
   * POST /api/auth/withdraw
   * Withdraw account (soft delete)
   */
  app.post(
    '/api/auth/withdraw',
    requireAuth,
    authController.withdraw.bind(authController)
  );

  /**
   * DELETE /api/auth/delete-account
   * Delete account permanently
   */
  app.delete(
    '/api/auth/delete-account',
    requireAuth,
    authController.deleteAccount.bind(authController)
  );

  // ==================== Phone Verification ====================
  // Note: These endpoints require SMS service integration
  // Implementation moved from routes.ts

  /**
   * POST /api/auth/send-signup-code
   * Send SMS verification code for signup
   */
  app.post('/api/auth/send-signup-code', signupRateLimiter, async (req, res) => {
    // TODO: Implement SMS verification
    res.status(501).json({
      success: false,
      error: 'SMS verification not yet implemented in modular structure',
    });
  });

  /**
   * POST /api/auth/verify-signup-code
   * Verify SMS code for signup
   */
  app.post('/api/auth/verify-signup-code', signupRateLimiter, async (req, res) => {
    // TODO: Implement SMS verification
    res.status(501).json({
      success: false,
      error: 'SMS verification not yet implemented in modular structure',
    });
  });

  /**
   * POST /api/auth/send-phone-code
   * Send phone verification code
   */
  app.post(
    '/api/auth/send-phone-code',
    strictRateLimiter,
    requireAuth,
    validateBody(authSchemas.sendPhoneCode),
    async (req, res) => {
      // TODO: Implement phone verification
      res.status(501).json({
        success: false,
        error: 'Phone verification not yet implemented in modular structure',
      });
    }
  );

  /**
   * POST /api/auth/verify-phone
   * Verify phone number with code
   */
  app.post(
    '/api/auth/verify-phone',
    requireAuth,
    validateBody(authSchemas.verifyPhone),
    async (req, res) => {
      // TODO: Implement phone verification
      res.status(501).json({
        success: false,
        error: 'Phone verification not yet implemented in modular structure',
      });
    }
  );

  // ==================== Identity Verification ====================

  /**
   * POST /api/auth/create-identity-verification
   * Create identity verification request
   */
  app.post('/api/auth/create-identity-verification', async (req, res) => {
    // TODO: Implement identity verification
    res.status(501).json({
      success: false,
      error: 'Identity verification not yet implemented in modular structure',
    });
  });

  /**
   * POST /api/auth/verify-identity
   * Verify identity
   */
  app.post('/api/auth/verify-identity', async (req, res) => {
    // TODO: Implement identity verification
    res.status(501).json({
      success: false,
      error: 'Identity verification not yet implemented in modular structure',
    });
  });

  // ==================== Social Auth (OAuth) ====================
  // Note: Kakao and Naver OAuth implementations
  // These will be moved to a separate social-auth module

  /**
   * GET /api/auth/kakao
   * Kakao OAuth login
   */
  app.get('/api/auth/kakao', (req, res) => {
    // TODO: Implement Kakao OAuth
    res.status(501).json({
      success: false,
      error: 'Kakao OAuth not yet implemented in modular structure',
    });
  });

  /**
   * GET /api/auth/kakao/helper
   * Kakao OAuth login for helper
   */
  app.get('/api/auth/kakao/helper', (req, res) => {
    // TODO: Implement Kakao OAuth
    res.status(501).json({
      success: false,
      error: 'Kakao OAuth not yet implemented in modular structure',
    });
  });

  /**
   * GET /api/auth/kakao/requester
   * Kakao OAuth login for requester
   */
  app.get('/api/auth/kakao/requester', (req, res) => {
    // TODO: Implement Kakao OAuth
    res.status(501).json({
      success: false,
      error: 'Kakao OAuth not yet implemented in modular structure',
    });
  });

  /**
   * GET /api/auth/kakao/helper/callback
   * Kakao OAuth callback for helper
   */
  app.get('/api/auth/kakao/helper/callback', async (req, res) => {
    // TODO: Implement Kakao OAuth callback
    res.status(501).json({
      success: false,
      error: 'Kakao OAuth callback not yet implemented in modular structure',
    });
  });

  /**
   * GET /api/auth/kakao/requester/callback
   * Kakao OAuth callback for requester
   */
  app.get('/api/auth/kakao/requester/callback', async (req, res) => {
    // TODO: Implement Kakao OAuth callback
    res.status(501).json({
      success: false,
      error: 'Kakao OAuth callback not yet implemented in modular structure',
    });
  });

  /**
   * GET /api/auth/kakao/callback
   * Kakao OAuth callback (general)
   */
  app.get('/api/auth/kakao/callback', async (req, res) => {
    // TODO: Implement Kakao OAuth callback
    res.status(501).json({
      success: false,
      error: 'Kakao OAuth callback not yet implemented in modular structure',
    });
  });

  /**
   * GET /api/auth/naver
   * Naver OAuth login
   */
  app.get('/api/auth/naver', (req, res) => {
    // TODO: Implement Naver OAuth
    res.status(501).json({
      success: false,
      error: 'Naver OAuth not yet implemented in modular structure',
    });
  });

  /**
   * GET /api/auth/naver/callback
   * Naver OAuth callback
   */
  app.get('/api/auth/naver/callback', async (req, res) => {
    // TODO: Implement Naver OAuth callback
    res.status(501).json({
      success: false,
      error: 'Naver OAuth callback not yet implemented in modular structure',
    });
  });

  console.log('✅ Auth routes registered');
}
