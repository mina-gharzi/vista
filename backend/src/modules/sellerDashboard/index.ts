import { prisma } from "../../db/prisma";
import { createSellerDashboardController } from "./sellerDashboard.controller";
import { createSellerDashboardRepository } from "./sellerDashboard.repository";
import { createSellerDashboardRouter } from "./sellerDashboard.routes";
import { createSellerDashboardService } from "./sellerDashboard.service";

const repository = createSellerDashboardRepository(prisma);
const service = createSellerDashboardService(repository);
const controller = createSellerDashboardController(service);

export const sellerDashboardRouter = createSellerDashboardRouter(controller);
