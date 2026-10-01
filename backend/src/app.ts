import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { createRateLimiter } from "./middlewares/rateLimit";
import { authRouter } from "./modules/auth";
import { categoriesRouter } from "./modules/categories";
import { productsRouter } from "./modules/products";
import { catalogRouter } from "./modules/catalog";
import { cartRouter } from "./modules/cart";
import { addressesRouter } from "./modules/addresses";
import { checkoutRouter, ordersRouter } from "./modules/orders";
import { wishlistRouter } from "./modules/wishlist";
import { productReviewsRouter, reviewsRouter } from "./modules/reviews";
import { NotFoundError } from "./errors/AppError";

export function createApp(): Express {
  const app = express();

  // --- Security ---
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true, // برای ارسال httpOnly Refresh Token Cookie
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" })); // جلوگیری از Body بزرگ غیرضروری

  // Rate Limiting عمومی — محدودتر برای مسیرهای Auth در سطح Router آن Module اعمال می‌شود
  app.use(createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 300 }));

  // --- Health Check ---
  app.get("/health", (_req, res) => {
    res.status(200).json({ success: true, data: { status: "ok" } });
  });

  // --- API Routes ---
  // هر Module کامل‌شده (طبق بخش ۳ و ۱۳ پرامپت مادر) Router خود را اینجا اضافه می‌کند.
  app.use("/api/auth", authRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/seller/products", productsRouter);
  app.use("/api/products", catalogRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/addresses", addressesRouter);
  app.use("/api/checkout", checkoutRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/wishlist", wishlistRouter);
  app.use("/api/products/:productId/reviews", productReviewsRouter);
  app.use("/api/reviews", reviewsRouter);

  // --- 404 ---
  app.use((req, _res, next) => {
    next(new NotFoundError(`مسیر ${req.method} ${req.path} یافت نشد`));
  });

  // --- Central Error Handler (باید آخرین Middleware باشد) ---
  app.use(errorHandler);

  return app;
}
