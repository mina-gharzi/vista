import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { MockPaymentProvider } from "../../payment/MockPaymentProvider";
import { createOrdersController } from "./orders.controller";
import { createOrdersRepository } from "./orders.repository";
import { createCheckoutRouter, createOrdersHistoryRouter } from "./orders.routes";
import { createOrdersService } from "./orders.service";

/**
 * ⚠️ تأیید پرداخت خودکار (Mock) فقط برای توسعه/دمو است و هرگز پرداخت واقعی را تأیید نمی‌کند.
 *  - در NODE_ENV=production همیشه خاموش است: سفارش در «در انتظار پرداخت» (PENDING) می‌ماند تا
 *    Feature «Payment» (تأیید درگاه + Webhook) پیاده شود.
 *  - در توسعه/تست با MOCK_PAYMENT_AUTO_CONFIRM=false هم می‌توان خاموشش کرد (برای آزمودن لغو سفارش).
 */
const mockAutoConfirm = env.NODE_ENV !== "production" && env.MOCK_PAYMENT_AUTO_CONFIRM;

const repository = createOrdersRepository(prisma);
const service = createOrdersService(repository, mockAutoConfirm ? new MockPaymentProvider() : null);
const controller = createOrdersController(service);

export const checkoutRouter = createCheckoutRouter(controller);
export const ordersRouter = createOrdersHistoryRouter(controller);
