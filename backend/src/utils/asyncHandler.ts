import type { Request, RequestHandler, Response } from "express";

/** Express 4 خطای Promise رد‌شده را خودکار به errorHandler نمی‌رساند؛ این Wrapper آن را به next(err) می‌دهد. */
export function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}
