import { prisma } from "../../db/prisma";
import { createAddressesController } from "./addresses.controller";
import { createAddressesRepository } from "./addresses.repository";
import { createAddressesRouter } from "./addresses.routes";
import { createAddressesService } from "./addresses.service";

const repository = createAddressesRepository(prisma);
const service = createAddressesService(repository);
const controller = createAddressesController(service);

export const addressesRouter = createAddressesRouter(controller);
