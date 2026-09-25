import type { Response } from "express";
import type { ApiSuccessResponse } from "@vista/shared";

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccessResponse<T> = { success: true, data };
  res.status(status).json(body);
}
