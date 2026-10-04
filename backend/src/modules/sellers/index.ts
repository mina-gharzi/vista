import { prisma } from "../../db/prisma";
import { createSellersController } from "./sellers.controller";
import { createSellersRepository } from "./sellers.repository";
import { createSellersRouter } from "./sellers.routes";
import { createSellersService } from "./sellers.service";

const repository = createSellersRepository(prisma);
const service = createSellersService(repository);
const controller = createSellersController(service);

export const sellersRouter = createSellersRouter(controller);
