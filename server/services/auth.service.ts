/**
 * Authentication Service
 * Handles all authentication-related business logic
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { storage, db } from '../storage';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type {
  LoginCredentials,
  SignupData,
  AuthTokens,
  AuthUser,
  PasswordResetRequest,
} from '../types/auth.types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';

export class AuthService {
  /**
   * User signup
   */
  async signup(data: SignupData): Promise<AuthUser> {
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(data.email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await storage.createUser({
      email: data.email,
      password: hashedPassword,
      name: data.name,
      username: data.email, // Use email as username
      phoneNumber: data.phone,
      role: data.role,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'helper' | 'requester' | 'admin',
      phone: user.phoneNumber || undefined,
    };
  }

  /**
   * User login
   */
  async login(credentials: LoginCredentials): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    // Find user by email
    const user = await storage.getUserByEmail(credentials.email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(credentials.password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const tokens = this.generateTokens(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'helper' | 'requester' | 'admin',
        phone: user.phoneNumber || undefined,
      },
      tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
      const user = await storage.getUser(decoded.userId);

      if (!user) {
        throw new Error('User not found');
      }

      return this.generateTokens(user.id);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Verify access token
   */
  async verifyToken(token: string): Promise<AuthUser> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await storage.getUser(decoded.userId);

      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'helper' | 'requester' | 'admin',
        phone: user.phoneNumber || undefined,
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Reset password
   */
  async resetPassword(data: PasswordResetRequest): Promise<void> {
    const user = await storage.getUserByEmail(data.email);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify phone matches
    if (user.phoneNumber !== data.phone) {
      throw new Error('Phone number does not match');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(data.newPassword, 10);

    // Update password
    await storage.updateUser(user.id, { password: hashedPassword });
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await storage.updateUser(userId, { password: hashedPassword });
  }

  /**
   * Update user role
   */
  async updateRole(userId: string, newRole: 'helper' | 'requester'): Promise<void> {
    await storage.updateUser(userId, { role: newRole });
  }

  /**
   * Delete user account
   * TODO: Implement proper user deletion/deactivation
   */
  async deleteAccount(userId: string): Promise<void> {
    // For now, just verify user exists
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    // TODO: Implement user deletion logic
    // Options: soft delete (add deletedAt field to schema), or hard delete
    throw new Error('User deletion not yet implemented');
  }

  /**
   * Generate JWT tokens
   */
  private generateTokens(userId: string): AuthTokens {
    const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    return { accessToken, refreshToken };
  }

  /**
   * Check if email exists
   */
  async checkEmailExists(email: string): Promise<boolean> {
    const user = await storage.getUserByEmail(email);
    return !!user;
  }

  /**
   * Find email by phone
   */
  async findEmailByPhone(phone: string): Promise<string | null> {
    // Query database directly for phone number
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, phone))
      .limit(1);

    return user ? user.email : null;
  }
}

// Export singleton instance
export const authService = new AuthService();
