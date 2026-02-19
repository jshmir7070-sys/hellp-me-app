import type { RouteContext } from "../types";
import { registerAuthRoutes } from "./auth.routes";
import { registerUserRoutes } from "./user.routes";
import { registerOrderRoutes } from "./order.routes";
import { registerSettlementRoutes } from "./settlement.routes";
import { registerSystemRoutes } from "./system.routes";

export async function registerAdminRoutes(ctx: RouteContext) {
    // Register all admin sub-modules
    await registerAuthRoutes(ctx);
    await registerUserRoutes(ctx);
    await registerOrderRoutes(ctx);
    await registerSettlementRoutes(ctx);
    await registerSystemRoutes(ctx);
}
