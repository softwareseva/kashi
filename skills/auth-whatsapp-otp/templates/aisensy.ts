/** AiSensy WhatsApp sender for @kashi/auth OTP. Secrets: AISENSY_API_KEY; vars: AISENSY_OTP_CAMPAIGN, AISENSY_SENDER_NAME. */
import type { AuthEnv } from "@kashi/auth/server";
import type { Context } from "hono";

type AiSensyBindings = { AISENSY_API_KEY: string; AISENSY_OTP_CAMPAIGN: string; AISENSY_SENDER_NAME?: string };

export async function sendAiSensyCode(_env: AuthEnv, destination: string, code: string, c: Context): Promise<void> {
  const b = c.env as AiSensyBindings;
  if (!b.AISENSY_API_KEY || !b.AISENSY_OTP_CAMPAIGN) throw new Error("AiSensy is not configured (AISENSY_API_KEY, AISENSY_OTP_CAMPAIGN).");
  const res = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      apiKey: b.AISENSY_API_KEY,
      campaignName: b.AISENSY_OTP_CAMPAIGN,
      destination,
      userName: b.AISENSY_SENDER_NAME ?? "App",
      templateParams: [code],
      buttons: [{ type: "button", sub_type: "url", index: 0, parameters: [{ type: "text", text: code }] }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`AiSensy request failed with status ${res.status}`);
}
