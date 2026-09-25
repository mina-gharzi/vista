/**
 * سلسله‌مراتب واحد Error برای کل Backend.
 * هیچ کلاس Error مستقل دیگری با رفتار مشابه در جای دیگر پروژه ساخته نشود.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: Record<string, string[]> | undefined;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = "داده‌های ارسالی معتبر نیستند", details?: Record<string, string[]>) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "احراز هویت ناموفق بود") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "شما اجازه دسترسی به این منبع را ندارید") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "منبع مورد نظر یافت نشد") {
    super(message, 404, "NOT_FOUND_ERROR");
  }
}

export class ConflictError extends AppError {
  constructor(message = "این عملیات با وضعیت فعلی داده‌ها تداخل دارد") {
    super(message, 409, "CONFLICT_ERROR");
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "حجم درخواست ارسالی بیش از حد مجاز است") {
    super(message, 413, "PAYLOAD_TOO_LARGE");
  }
}

export class DatabaseError extends AppError {
  constructor(message = "خطای پایگاه داده رخ داد") {
    super(message, 500, "DATABASE_ERROR");
  }
}
