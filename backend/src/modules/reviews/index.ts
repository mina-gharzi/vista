import { prisma } from "../../db/prisma";
import { createReviewsController } from "./reviews.controller";
import { createReviewsRepository } from "./reviews.repository";
import { createProductReviewsRouter, createReviewsRouter } from "./reviews.routes";
import { createReviewsService } from "./reviews.service";

const repository = createReviewsRepository(prisma);
const service = createReviewsService(repository);
const controller = createReviewsController(service);

export const productReviewsRouter = createProductReviewsRouter(controller);
export const reviewsRouter = createReviewsRouter(controller);
