import { randomUUID } from "node:crypto";
import type {
  OrderPaymentInput,
  PaymentProvider,
  PaymentSessionResult,
  PaymentVerificationResult,
} from "./PaymentProvider";

/**
 * درگاه پرداخت Mock — فقط برای توسعه و تست.
 * همیشه پرداخت را موفق در نظر می‌گیرد. هرگز در Production استفاده نشود
 * (انتخاب Provider واقعی باید در config/env بر اساس NODE_ENV کنترل شود).
 */
export class MockPaymentProvider implements PaymentProvider {
  async createPaymentSession(input: OrderPaymentInput): Promise<PaymentSessionResult> {
    const providerRef = `mock_${randomUUID()}`;
    return {
      redirectUrl: `${input.callbackUrl}?providerRef=${providerRef}&status=success`,
      providerRef,
    };
  }

  async verifyPayment(providerRef: string): Promise<PaymentVerificationResult> {
    return {
      success: true,
      transactionId: `txn_${providerRef}`,
    };
  }
}
