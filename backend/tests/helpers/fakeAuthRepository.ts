import { randomUUID } from "node:crypto";
import { ConflictError } from "../../src/errors/AppError";
import type {
  AuthRepository,
  NewRefreshToken,
  RefreshTokenRecord,
  UserRecord,
} from "../../src/modules/auth/auth.repository";

interface StoredToken extends RefreshTokenRecord {
  tokenHash: string;
}

/** Repository درون‌حافظه‌ای با همان قرارداد Prisma Repository (برای تست Service/API بدون Database). */
export class FakeAuthRepository implements AuthRepository {
  readonly users = new Map<string, UserRecord>();
  readonly tokens: StoredToken[] = [];

  async findUserByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findUserById(id: string) {
    return this.users.get(id) ?? null;
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone: string | null;
  }) {
    if (await this.findUserByEmail(data.email))
      throw new ConflictError("این ایمیل قبلاً ثبت شده است");
    const user: UserRecord = { id: randomUUID(), role: "CUSTOMER", createdAt: new Date(), ...data };
    this.users.set(user.id, user);
    return user;
  }

  async createRefreshToken(data: NewRefreshToken) {
    this.tokens.push({ id: randomUUID(), revokedAt: null, ...data });
  }

  async findRefreshToken(tokenHash: string) {
    return this.tokens.find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async rotateRefreshToken(oldId: string, next: NewRefreshToken) {
    const old = this.tokens.find((token) => token.id === oldId);
    if (!old || old.revokedAt) return false;
    old.revokedAt = new Date();
    await this.createRefreshToken(next);
    return true;
  }

  async revokeRefreshToken(tokenHash: string) {
    const token = this.tokens.find((item) => item.tokenHash === tokenHash);
    if (token && !token.revokedAt) token.revokedAt = new Date();
  }

  async revokeAllUserTokens(userId: string) {
    for (const token of this.tokens) {
      if (token.userId === userId && !token.revokedAt) token.revokedAt = new Date();
    }
  }
}
