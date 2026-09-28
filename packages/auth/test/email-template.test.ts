import { describe, expect, it } from "vitest";
import { renderOtpEmail } from "../src/server/email-template";

describe("renderOtpEmail", () => {
  it("uses distinct wording for sign-in and link purposes", () => {
    const signIn = renderOtpEmail({ code: "123456", purpose: "sign-in", ttlSeconds: 300 });
    const link = renderOtpEmail({ code: "123456", purpose: "link", ttlSeconds: 300 });
    expect(signIn.subject).toMatch(/sign.in/i);
    expect(link.subject).toMatch(/confirm/i);
    expect(signIn.text).not.toBe(link.text);
    expect(signIn.html).not.toBe(link.html);
  });

  it("renders the configured expiry in both text and html", () => {
    const email = renderOtpEmail({ code: "123456", purpose: "sign-in", ttlSeconds: 90 });
    expect(email.text).toContain("2 minutes");
    expect(email.html).toContain("2 minutes");
    const short = renderOtpEmail({ code: "123456", purpose: "sign-in", ttlSeconds: 45 });
    expect(short.text).toContain("45 seconds");
    const long = renderOtpEmail({ code: "123456", purpose: "sign-in", ttlSeconds: 7200 });
    expect(long.text).toContain("2 hours");
  });

  it("keeps the plain-text and html bodies in parity", () => {
    const email = renderOtpEmail({ code: "654321", purpose: "link", ttlSeconds: 600, brand: { name: "Acme" } });
    expect(email.text).toContain("654321");
    expect(email.html).toContain("654321");
    expect(email.text).toContain("10 minutes");
    expect(email.html).toContain("10 minutes");
    expect(email.subject).toContain("Acme");
    expect(email.text).toContain("didn't request this");
    expect(email.html).toContain("didn't request this");
  });

  it("escapes dynamic html and never embeds remote images", () => {
    const email = renderOtpEmail({ code: "<b>123456</b>", purpose: "sign-in", ttlSeconds: 300, brand: { name: "<script>alert(1)</script>" } });
    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.html).not.toContain("<b>123456</b>");
    expect(email.html).toContain("&lt;b&gt;123456&lt;/b&gt;");
    expect(email.html).not.toMatch(/<img/i);
    expect(email.html).not.toContain("http://");
    expect(email.html).not.toContain("https://");
  });

  it("strips line breaks from brand text so it cannot inject extra subject header lines", () => {
    const email = renderOtpEmail({ code: "123456", purpose: "sign-in", ttlSeconds: 300, brand: { name: "Acme\r\nBcc: evil@example.com" } });
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.subject).toBe("Your sign-in code · Acme Bcc: evil@example.com");
  });

  it("applies brand colors and falls back to neutral defaults", () => {
    const branded = renderOtpEmail({ code: "123456", purpose: "sign-in", ttlSeconds: 300, brand: { backgroundColor: "#000000", accentColor: "#ff0000", textColor: "#ffffff" } });
    expect(branded.html).toContain("#000000");
    expect(branded.html).toContain("#ff0000");
    expect(branded.html).toContain("#ffffff");
    const neutral = renderOtpEmail({ code: "123456", purpose: "sign-in", ttlSeconds: 300 });
    expect(neutral.html).toContain("#f4f4f7");
    expect(neutral.html).toContain("#4f46e5");
  });
});
