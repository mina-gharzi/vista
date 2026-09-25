/**
 * Interface درگاه پرداخت. هیچ Service یا Controller نباید مستقیماً به یک درگاه خاص
 * (مثلاً زرین‌پال) وابسته باشد؛ فقط به این Interface وابسته است.
 * وقتی درگاه واقعی مشخص شد، کافیست یک کلاس جدید همین Interface را پیاده‌سازی کند.
 */
export interface OrderPaymentInput {
  orderId: string;
  amount: number;
  userMobile?: string;
  callbackUrl: string;
}

export interface PaymentSessionResult {
  redirectUrl: string;
  providerRef: string;
}

export interface PaymentVerificationResult {
  success: boolean;
  transactionId: string;
}

export interface PaymentProvider {
  createPaymentSession(input: OrderPaymentInput): Promise<PaymentSessionResult>;
  verifyPayment(providerRef: string, query: Record<string, unknown>): Promise<PaymentVerificationResult>;
}
