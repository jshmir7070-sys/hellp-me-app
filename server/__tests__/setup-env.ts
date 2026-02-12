/**
 * Jest setup: provide test environment variables
 * so that modules requiring DATABASE_URL don't throw on import.
 */
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/testdb';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret';
process.env.NODE_ENV = 'test';
