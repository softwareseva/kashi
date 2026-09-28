/** Default email template for one-time codes. Pure formatting — never sends anything. */
import type { OtpPurpose } from "./types";

export type OtpEmailPurpose = OtpPurpose;

export type OtpEmailBrand = {
  /** Shown in the heading and, trimmed of line breaks, appended to the subject. */
  name?: string;
  /** Page background behind the card. Default `#f4f4f7`. */
  backgroundColor?: string;
  /** Border and code color. Default `#4f46e5`. */
  accentColor?: string;
  /** Body text color. Default `#1f2937`. */
  textColor?: string;
};

export type RenderOtpEmailInput = {
  code: string;
  purpose: OtpEmailPurpose;
  /** How long the code stays valid, in seconds. */
  ttlSeconds: number;
  brand?: OtpEmailBrand;
};

export type RenderedEmail = { subject: string; text: string; html: string };

/** Escapes `&<>"'` so untrusted text is safe inside HTML text and attribute contexts. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/** Strips line breaks and other control characters so brand text cannot inject extra header lines. */
function singleLine(value: string): string {
  return value.replace(/[\r\n\t\x00-\x1f\x7f]+/g, " ").trim();
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(1, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function copy(purpose: OtpEmailPurpose, brandName: string | undefined) {
  const suffix = brandName ? ` for ${brandName}` : "";
  if (purpose === "link") {
    return {
      subjectLabel: "Confirm your email",
      heading: `Confirm your email${brandName ? ` · ${brandName}` : ""}`,
      intro: `Enter this code to confirm and link this email address${suffix}.`,
    };
  }
  return {
    subjectLabel: "Your sign-in code",
    heading: `Sign in${brandName ? ` to ${brandName}` : ""}`,
    intro: `Enter this code to sign in${suffix}.`,
  };
}

/** Builds the subject, plain-text and HTML body for a one-time-code email. Sends nothing. */
export function renderOtpEmail(input: RenderOtpEmailInput): RenderedEmail {
  const code = String(input.code);
  const brandName = input.brand?.name ? singleLine(input.brand.name) : undefined;
  const background = input.brand?.backgroundColor ?? "#f4f4f7";
  const accent = input.brand?.accentColor ?? "#4f46e5";
  const textColor = input.brand?.textColor ?? "#1f2937";
  const { subjectLabel, heading, intro } = copy(input.purpose, brandName);
  const ttl = formatDuration(input.ttlSeconds);

  const subject = brandName ? `${subjectLabel} · ${brandName}` : subjectLabel;

  const text = [heading, "", intro, "", code, "", `This code expires in ${ttl}.`, "", "If you didn't request this, you can safely ignore this email."].join("\n");

  const safeCode = escapeHtml(code);
  const safeHeading = escapeHtml(heading);
  const safeIntro = escapeHtml(intro);
  const safeTtl = escapeHtml(ttl);

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${background};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${background};padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <h1 style="margin:0 0 12px 0;font-size:20px;line-height:28px;color:${textColor};">${safeHeading}</h1>
                <p style="margin:0 0 20px 0;font-size:15px;line-height:22px;color:${textColor};">${safeIntro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${accent};border-radius:8px;">
                  <tr>
                    <td align="center" style="padding:20px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:${accent};">
                      ${safeCode}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <p style="margin:0 0 12px 0;font-size:13px;line-height:20px;color:${textColor};">This code expires in ${safeTtl}.</p>
                <p style="margin:0;font-size:13px;line-height:20px;color:${textColor};">If you didn't request this, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
