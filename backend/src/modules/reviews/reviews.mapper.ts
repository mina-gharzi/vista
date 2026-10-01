import type { ReviewSummary } from "@vista/shared";
import type { ReviewRow } from "./reviews.repository";

export function toReviewSummary(row: ReviewRow, viewerUserId: string | undefined): ReviewSummary {
  return {
    id: row.id,
    userName: row.user.fullName,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isMine: viewerUserId !== undefined && viewerUserId === row.userId,
  };
}
