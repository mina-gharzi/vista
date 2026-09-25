import { prisma } from "../../db/prisma";
import { createAuthController } from "./auth.controller";
import { createAuthRepository } from "./auth.repository";
import { createAuthRouter } from "./auth.routes";
import { createAuthService } from "./auth.service";

// Composition Root ماژول: Prisma → Repository → Service → Controller → Router
const repository = createAuthRepository(prisma);
const service = createAuthService(repository);
const controller = createAuthController(service);

export const authRouter = createAuthRouter(controller);
