import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const okResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), { status });

const errorResponse = (status: number, code = "AUTHENTICATION_ERROR") =>
  new Response(JSON.stringify({ success: false, error: { code, message: "خطا" } }), { status });

const session = (token: string) => ({
  accessToken: token,
  user: {
    id: "u1",
    email: "a@b.com",
    fullName: "Test",
    phone: null,
    role: "CUSTOMER",
    createdAt: "",
  },
});

function headerOf(call: unknown[], name: string): string | undefined {
  const init = call[1] as { headers?: Record<string, string> } | undefined;
  return init?.headers?.[name];
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules(); // هر تست State ماژول‌ها (tokenStore، inFlight) را تازه می‌خواهد
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("data موفق را برمی‌گرداند", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ hello: "world" }));
    const { apiRequest } = await import("@/lib/api/client");

    await expect(apiRequest("/x")).resolves.toEqual({ hello: "world" });
  });

  it("پاسخ غیر JSON (مثلاً 502) را به INVALID_RESPONSE تبدیل می‌کند", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>Bad Gateway</html>", { status: 502 }));
    const { apiRequest, ApiRequestError } = await import("@/lib/api/client");

    const error = await apiRequest("/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 502, code: "INVALID_RESPONSE" });
  });

  it("قطعی شبکه را به NETWORK_ERROR تبدیل می‌کند", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const { apiRequest } = await import("@/lib/api/client");

    await expect(apiRequest("/x")).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });

  it("درخواست بدون auth با 401 هرگز Refresh نمی‌زند", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(401));
    await import("@/lib/auth/session");
    const { apiRequest } = await import("@/lib/api/client");

    await expect(apiRequest("/public")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("درخواست auth با 401: Session را تمدید و دقیقاً یک‌بار با توکن جدید تکرار می‌کند", async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(401)) // /private با توکن منقضی
      .mockResolvedValueOnce(okResponse(session("fresh-token"))) // /auth/refresh
      .mockResolvedValueOnce(okResponse({ secret: 1 })); // تکرار /private
    await import("@/lib/auth/session");
    const { apiRequest } = await import("@/lib/api/client");
    const { setAccessToken } = await import("@/lib/auth/tokenStore");
    setAccessToken("expired-token");

    await expect(apiRequest("/private", { auth: true })).resolves.toEqual({ secret: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(headerOf(fetchMock.mock.calls[0] ?? [], "Authorization")).toBe("Bearer expired-token");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/auth/refresh");
    expect(headerOf(fetchMock.mock.calls[2] ?? [], "Authorization")).toBe("Bearer fresh-token");
  });

  it("اگر Refresh رد شود همان 401 برمی‌گردد و تکراری در کار نیست", async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(401)) // /private
      .mockResolvedValueOnce(errorResponse(401)); // /auth/refresh رد شد
    await import("@/lib/auth/session");
    const { apiRequest } = await import("@/lib/api/client");

    await expect(apiRequest("/private", { auth: true })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("refreshSession", () => {
  it("Single-flight: چند فراخوانی همزمان فقط یک درخواست Refresh می‌فرستند", async () => {
    fetchMock.mockResolvedValue(okResponse(session("t1")));
    const { refreshSession } = await import("@/lib/auth/session");
    const { getAccessToken } = await import("@/lib/auth/tokenStore");

    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r?.accessToken === "t1")).toBe(true);
    expect(getAccessToken()).toBe("t1");
  });

  it("با 401 مقدار null برمی‌گرداند، توکن را پاک و پایان Session را اعلام می‌کند", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(401));
    const { refreshSession, subscribeToSessionEnd } = await import("@/lib/auth/session");
    const { getAccessToken, setAccessToken } = await import("@/lib/auth/tokenStore");
    setAccessToken("old");
    const onEnd = vi.fn();
    subscribeToSessionEnd(onEnd);

    await expect(refreshSession()).resolves.toBeNull();

    expect(getAccessToken()).toBeNull();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("خطای شبکه Session را پاک نمی‌کند (مشکل موقتی است)", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const { refreshSession } = await import("@/lib/auth/session");
    const { getAccessToken, setAccessToken } = await import("@/lib/auth/tokenStore");
    setAccessToken("still-valid");

    await expect(refreshSession()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(getAccessToken()).toBe("still-valid");
  });
});
