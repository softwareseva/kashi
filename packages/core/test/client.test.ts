import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "../src/client";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("client", () => {
  it("unwraps data and throws ApiError with fields", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(200, { data: { id: 1 } })).mockResolvedValueOnce(json(422, { code: "VALIDATION_ERROR", message: "Invalid", requestId: "r", fields: { name: ["Required"] } }));
    const api = createApiClient({ baseUrl: "https://x/v1", fetch: fetchMock });
    expect(await api.get<{ id: number }>("/things/1")).toEqual({ id: 1 });
    await expect(api.post("/things", {})).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422, fields: { name: ["Required"] } } satisfies Partial<ApiError>);
  });
  it("refreshes once and retries, sharing the refresh across concurrent 401s", async () => {
    const fetchMock = vi.fn(async (url: string) => (url.endsWith("/a") || url.endsWith("/b")) && fetchMock.mock.calls.length <= 2 ? json(401, { code: "UNAUTHORIZED", message: "x", requestId: "r" }) : json(200, { data: url.slice(-1) }));
    const refresh = vi.fn().mockResolvedValue(true);
    const api = createApiClient({ baseUrl: "https://x/v1", fetch: fetchMock as unknown as typeof fetch, refresh });
    const [a, b] = await Promise.all([api.get<string>("/a"), api.get<string>("/b")]);
    expect([a, b]).toEqual(["a", "b"]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
