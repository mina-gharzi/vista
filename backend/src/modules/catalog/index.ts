import { prisma } from "../../db/prisma";
import { createCatalogController } from "./catalog.controller";
import { createCatalogRepository } from "./catalog.repository";
import { createCatalogRouter } from "./catalog.routes";
import { createCatalogService } from "./catalog.service";

// Composition Root ماژول: Prisma → Repository → Service → Controller → Router
const repository = createCatalogRepository(prisma);
const service = createCatalogService(repository);
const controller = createCatalogController(service);

export const catalogRouter = createCatalogRouter(controller);
