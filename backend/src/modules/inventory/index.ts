import { prisma } from "../../db/prisma";
import { createInventoryController } from "./inventory.controller";
import { createInventoryRepository } from "./inventory.repository";
import { createInventoryRouter } from "./inventory.routes";
import { createInventoryService } from "./inventory.service";

// Composition Root ماژول: Prisma → Repository → Service → Controller → Router
const repository = createInventoryRepository(prisma);
const service = createInventoryService(repository);
const controller = createInventoryController(service);

export const inventoryRouter = createInventoryRouter(controller);
