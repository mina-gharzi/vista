import { prisma } from "../../db/prisma";
import { MockPaymentProvider } from "../../payment/MockPaymentProvider";
import { createOrdersController } from "./orders.controller";
import { createOrdersRepository } from "./orders.repository";
import { createCheckoutRouter, createOrdersHistoryRouter } from "./orders.routes";
import { createOrdersService } from "./orders.service";

// ⚠️ MockPaymentProvider همیشه موفق است و فقط برای توسعه/دمو است؛ در Feature «Payment» (Phase 4)
// انتخاب Provider باید بر اساس NODE_ENV کنترل شود (نگاه کنید به ARCHITECTURE.md بخش ۶).
const repository = createOrdersRepository(prisma);
const service = createOrdersService(repository, new MockPaymentProvider());
const controller = createOrdersController(service);

export const checkoutRouter = createCheckoutRouter(controller);
export const ordersRouter = createOrdersHistoryRouter(controller);
