$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/hellpme"
$env:SESSION_SECRET = "dev-session-secret-change-in-production-32chars"
$env:JWT_SECRET = "dev-jwt-secret-change-in-production-32chars"
$env:ENCRYPTION_KEY = "dev-encryption-key-change-in-production-32chars"
$env:NODE_ENV = "development"

npx tsx server/index.ts
