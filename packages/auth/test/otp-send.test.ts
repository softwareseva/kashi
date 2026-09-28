import type { Context } from "hono";
import { describe, expect, it } from "vitest";
import type { AuthEnv, OtpProviderConfig } from "../src/server/types";

describe("otp send callback", () => {
  it("stays type-compatible with existing four-argument senders and still receives them", async () => {
    const calls: Array<{ destination: string; code: string }> = [];
    const fourArgSend: (env: AuthEnv, destination: string, code: string, c: Context) => Promise<void> = async (_env, destination, code) => {
      calls.push({ destination, code });
    };
    const config: OtpProviderConfig = { channel: "email", send: fourArgSend };
    await config.send({} as AuthEnv, "user@example.com", "123456", {} as Context, { purpose: "sign-in", ttlSeconds: 300 });
    expect(calls).toEqual([{ destination: "user@example.com", code: "123456" }]);
  });

  it("passes purpose and the configured ttl to a five-argument sender", async () => {
    let seen: { purpose: string; ttlSeconds: number } | undefined;
    const config: OtpProviderConfig = {
      channel: "email",
      ttlSeconds: 900,
      send: async (_env, _destination, _code, _c, meta) => {
        seen = meta;
      },
    };
    await config.send({} as AuthEnv, "user@example.com", "123456", {} as Context, { purpose: "link", ttlSeconds: config.ttlSeconds! });
    expect(seen).toEqual({ purpose: "link", ttlSeconds: 900 });
  });
});
