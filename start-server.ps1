$env:DATABASE_URL = "postgresql://postgres:jsh%21%2115988@localhost:5432/hellpme"
$env:SESSION_SECRET = "NVi+Xvin30/E8Tmiqm6ga5zFEx7iGgL4IHUjh1OZ+hA="
$env:JWT_SECRET = "ENVCAdhnEo6a9REO7k9glWgrogDNB3nTcPJeG/wREBM="
$env:NODE_ENV = "development"

npx tsx server/index.ts
