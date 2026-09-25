/** WhatsApp Cloud API sender for @softwareseva/auth OTP. Secrets: WHATSAPP_TOKEN; vars: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE, WHATSAPP_TEMPLATE_LANG. */
import type { AuthEnv } from "@softwareseva/auth/server";
import type { Context } from "hono";

type MetaBindings = { WHATSAPP_TOKEN: string; WHATSAPP_PHONE_NUMBER_ID: string; WHATSAPP_TEMPLATE: string; WHATSAPP_TEMPLATE_LANG?: string };

export async function sendMetaWhatsAppCode(_env: AuthEnv, destination: string, code: string, c: Context): Promise<void> {
  const b = c.env as MetaBindings;
  if (!b.WHATSAPP_TOKEN || !b.WHATSAPP_PHONE_NUMBER_ID || !b.WHATSAPP_TEMPLATE) throw new Error("WhatsApp Cloud API is not configured.");
  const res = await fetch(`https://graph.facebook.com/v23.0/${b.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${b.WHATSAPP_TOKEN}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: destination.replace(/^\+/, ""),
      type: "template",
      template: {
        name: b.WHATSAPP_TEMPLATE,
        language: { code: b.WHATSAPP_TEMPLATE_LANG ?? "en" },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`WhatsApp Cloud API request failed with status ${res.status}`);
}
