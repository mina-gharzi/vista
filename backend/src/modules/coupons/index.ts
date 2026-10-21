import { prisma } from "../../db/prisma";
import { createRateLimiter } from "../../middlewares/rateLimit";
import { createFindUserRole, createRequireAdmin } from "../admin/admin.guard";
import { createAdminCouponsController } from "./adminCoupons.controller";
import { createAdminCouponsRepository } from "./adminCoupons.repository";
import { createAdminCouponsRouter } from "./adminCoupons.routes";
import { createAdminCouponsService } from "./adminCoupons.service";
import { createCouponsController } from "./coupons.controller";
import { createCouponsRepository } from "./coupons.repository";
import { createCouponsRouter } from "./coupons.routes";
import { createCouponsService } from "./coupons.service";

// حدس‌زدن کد کوپن را کند می‌کند (در NODE_ENV=test غیرفعال است)
const validateLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, limit: 40 });

export const couponsRouter = createCouponsRouter(
  createCouponsController(createCouponsService(createCouponsRepository(prisma))),
  validateLimiter,
);

export const adminCouponsRouter = createAdminCouponsRouter(
  createAdminCouponsController(createAdminCouponsService(createAdminCouponsRepository(prisma))),
  createRequireAdmin(createFindUserRole(prisma)),
);
