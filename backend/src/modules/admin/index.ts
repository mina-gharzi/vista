import { prisma } from "../../db/prisma";
import { createAdminController } from "./admin.controller";
import { createFindUserRole, createRequireAdmin } from "./admin.guard";
import { createAdminRouter } from "./admin.routes";
import { createAdminCategoriesRepository } from "./adminCategories.repository";
import { createAdminCategoriesService } from "./adminCategories.service";
import { createAdminDashboardRepository } from "./adminDashboard.repository";
import { createAdminDashboardService } from "./adminDashboard.service";
import { createAdminOrdersRepository } from "./adminOrders.repository";
import { createAdminOrdersService } from "./adminOrders.service";
import { createAdminProductsRepository } from "./adminProducts.repository";
import { createAdminProductsService } from "./adminProducts.service";
import { createAdminSellersRepository } from "./adminSellers.repository";
import { createAdminSellersService } from "./adminSellers.service";

const controller = createAdminController({
  dashboard: createAdminDashboardService(createAdminDashboardRepository(prisma)),
  sellers: createAdminSellersService(createAdminSellersRepository(prisma)),
  products: createAdminProductsService(createAdminProductsRepository(prisma)),
  categories: createAdminCategoriesService(createAdminCategoriesRepository(prisma)),
  orders: createAdminOrdersService(createAdminOrdersRepository(prisma)),
});

export const adminRouter = createAdminRouter(controller, createRequireAdmin(createFindUserRole(prisma)));
