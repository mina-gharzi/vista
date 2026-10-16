import type { Prisma } from "@prisma/client";
import type { AdminAuditAction, AdminAuditEntry, AdminAuditTargetType } from "@vista/shared";

/** ورودی ثبت ممیزی؛ adminId همیشه از توکن احرازشده می‌آید (هرگز از Body) */
export interface AuditInput {
  adminId: string;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  /** جزئیات غیرحساس (بدون رمز/توکن/اطلاعات شخصی) */
  details?: Prisma.InputJsonValue;
}

export function toAuditCreateData(input: AuditInput): Prisma.AdminAuditLogUncheckedCreateInput {
  return {
    actorId: input.adminId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    reason: input.reason ?? null,
    ...(input.details !== undefined ? { details: input.details } : {}),
  };
}

export const AUDIT_ENTRY_SELECT = {
  id: true,
  action: true,
  fromStatus: true,
  toStatus: true,
  reason: true,
  createdAt: true,
  actor: { select: { fullName: true } },
} satisfies Prisma.AdminAuditLogSelect;

export interface AuditRow {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  createdAt: Date;
  actor: { fullName: string };
}

export function toAuditEntry(row: AuditRow): AdminAuditEntry {
  return {
    id: row.id,
    action: row.action as AdminAuditAction,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    reason: row.reason,
    adminName: row.actor.fullName,
    createdAt: row.createdAt.toISOString(),
  };
}
