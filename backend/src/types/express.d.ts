import type { UserRole } from "@vista/shared";

declare global {
  namespace Express {
    interface Request {
      /** توسط requireAuth پر می‌شود؛ در Routeهای عمومی undefined است */
      auth?: { userId: string; role: UserRole };
    }
  }
}

export {};
