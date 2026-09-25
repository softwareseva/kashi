# OTP delivery providers

## AiSensy (WhatsApp, India)

1. Create a WhatsApp template in the AUTHENTICATION category with one body variable (`{{1}}` = code) and a "copy code" URL button.
2. Create an API campaign that uses the template; note its campaign name.
3. Secrets: `AISENSY_API_KEY` (secret), `AISENSY_OTP_CAMPAIGN` (var), `AISENSY_SENDER_NAME` (var, shown as the user name in AiSensy).
4. Endpoint: `POST https://backend.aisensy.com/campaign/t1/api/v2` with `destination` in E.164 without `+` accepted as well.

## WhatsApp Cloud API (Meta)

1. Meta Business Suite: create an app with the WhatsApp product, register a phone number, note the phone number id.
2. Create a system user and a permanent token with `whatsapp_business_messaging`.
3. Create an AUTHENTICATION template (for example `login_code`) with a copy-code button.
4. Secrets: `WHATSAPP_TOKEN` (secret), `WHATSAPP_PHONE_NUMBER_ID` (var), `WHATSAPP_TEMPLATE` (var), `WHATSAPP_TEMPLATE_LANG` (var, e.g. `en`).

## SMS (Twilio, MSG91, etc.)

Same shape: one `fetch` with basic or bearer auth, timeout, throw on failure. In India, SMS needs DLT-registered templates and sender ids; WhatsApp is usually cheaper and faster to approve.

## Email

Use the `channel: "email"` provider with a transactional email API (Resend, Postmark, SES). Keep the message short: the code, its lifetime, and "ignore this if you did not ask for it".

## Cost and abuse

- Per-destination limit (3 per 10 minutes) caps spend per number.
- Consider blocking premium-rate prefixes and countries you do not serve before calling the provider.
- Monitor delivery failures; a sudden rise in requests for sequential numbers is SMS pumping.
