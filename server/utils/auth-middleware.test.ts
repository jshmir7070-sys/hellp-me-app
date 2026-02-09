import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  requireAuth,
  adminAuth,
  requireRole,
  requireOwner,
  AuthenticatedRequest,
} from './auth-middleware';
import { storage } from '../storage';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../storage');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

describe('Auth Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should reject request without authorization header', async () => {
      await requireAuth(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await requireAuth(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request when user not found', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user-123' });
      (storage.getUser as jest.Mock).mockResolvedValue(null);

      await requireAuth(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should authenticate valid user and call next', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'helper',
        email: 'user@test.com',
      };

      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user-123' });
      (storage.getUser as jest.Mock).mockResolvedValue(mockUser);

      await requireAuth(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(jwt.verify).toHaveBeenCalledWith('valid-token', JWT_SECRET);
      expect(storage.getUser).toHaveBeenCalledWith('user-123');
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('adminAuth', () => {
    it('should reject non-admin users', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'helper',
        email: 'user@test.com',
      };

      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user-123' });
      (storage.getUser as jest.Mock).mockResolvedValue(mockUser);

      await adminAuth(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Admin access required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should authenticate admin user', async () => {
      const mockAdmin = {
        id: 'admin-123',
        role: 'admin',
        email: 'admin@test.com',
      };

      mockRequest.headers = { authorization: 'Bearer admin-token' };
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'admin-123' });
      (storage.getUser as jest.Mock).mockResolvedValue(mockAdmin);

      await adminAuth(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.adminUser).toEqual(mockAdmin);
      expect(mockRequest.user).toEqual(mockAdmin);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should authenticate superadmin user', async () => {
      const mockSuperAdmin = {
        id: 'superadmin-123',
        role: 'superadmin',
        email: 'superadmin@test.com',
      };

      mockRequest.headers = { authorization: 'Bearer superadmin-token' };
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'superadmin-123' });
      (storage.getUser as jest.Mock).mockResolvedValue(mockSuperAdmin);

      await adminAuth(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.adminUser).toEqual(mockSuperAdmin);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject HQ staff without admin role', async () => {
      const mockHQStaff = {
        id: 'hq-123',
        role: 'helper',
        isHqStaff: true,
        email: 'hq@test.com',
      };

      mockRequest.headers = { authorization: 'Bearer hq-token' };
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'hq-123' });
      (storage.getUser as jest.Mock).mockResolvedValue(mockHQStaff);

      await adminAuth(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Admin access required' });
    });
  });

  describe('requireRole', () => {
    it('should reject unauthenticated requests', () => {
      const middleware = requireRole('helper');

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: '인증이 필요합니다' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow users with matching role', () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'helper',
      };

      const middleware = requireRole('helper', 'requester');

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject users without matching role', () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'helper',
      };

      const middleware = requireRole('requester');

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: '권한이 없습니다' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow HQ staff regardless of role', () => {
      mockRequest.user = {
        id: 'hq-123',
        role: 'helper',
        isHqStaff: true,
      };

      const middleware = requireRole('requester');

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow admin users regardless of role', () => {
      mockRequest.user = {
        id: 'admin-123',
        role: 'admin',
      };

      const middleware = requireRole('helper', 'requester');

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('requireOwner', () => {
    it('should reject unauthenticated requests', async () => {
      const middleware = requireOwner('order');

      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: '인증이 필요합니다' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow HQ staff without ownership check', async () => {
      mockRequest.user = {
        id: 'hq-123',
        role: 'helper',
        isHqStaff: true,
      };

      const middleware = requireOwner('order');

      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow admin users without ownership check', async () => {
      mockRequest.user = {
        id: 'admin-123',
        role: 'admin',
      };

      const middleware = requireOwner('order');

      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('Token Extraction', () => {
    it('should handle Bearer token format', async () => {
      mockRequest.headers = { authorization: 'Bearer my-token-123' };
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user-123' });
      (storage.getUser as jest.Mock).mockResolvedValue({
        id: 'user-123',
        role: 'helper',
      });

      await requireAuth(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(jwt.verify).toHaveBeenCalledWith('my-token-123', JWT_SECRET);
    });

    it('should reject malformed authorization header', async () => {
      mockRequest.headers = { authorization: 'InvalidFormat' };

      await requireAuth(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
