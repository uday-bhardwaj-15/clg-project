import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import sanityClient from "@sanity/client";

// --------------------------------------------------
// Sanity
// --------------------------------------------------
const sanity = sanityClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET || "production",
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
});

// --------------------------------------------------
// Escape HTML (security)
// --------------------------------------------------
function escapeHtml(str: string) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --------------------------------------------------
// Convert plain text → HTML formatted paragraphs
// --------------------------------------------------
function convertToHtml(text: string) {
  if (!text) return "";

  // Normalize
  const cleaned = text.replace(/\r\n/g, "\n").trim();

  // Split into paragraphs
  const blocks =
    cleaned.includes("\n\n")
      ? cleaned.split(/\n\s*\n/)
      : cleaned.split(/\n/);

  return blocks
    .map((b) => {
      const escaped = escapeHtml(b.trim());
      const withBr = escaped.replace(/\n/g, "<br>");
      return `<p style="margin:0 0 14px 0; font-size:15px; line-height:1.5; color:#334155;">${withBr}</p>`;
    })
    .join("\n");
}

// --------------------------------------------------
// HTML TEMPLATE (subject + formatted paragraphs)
// --------------------------------------------------
function emailTemplate(subject: string, bodyHtml: string) {
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0; padding:20px; background:#f5f7fa; font-family:Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table width="600" style="background:white; border-radius:12px; padding:24px;">
            <tr>
              <td>
                <h2 style="margin:0 0 16px 0; color:#0f172a;">${escapeHtml(subject)}</h2>
                ${bodyHtml}
                <p style="margin-top:20px;">Sincerely,<br><strong>Your Sender</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

// --------------------------------------------------
// Main POST handler
// --------------------------------------------------
export async function POST(req: Request) {
  try {
    const { to, subject, html } = await req.json();

    if (!to) {
      return NextResponse.json(
        { ok: false, error: "Missing recipient email" },
        { status: 400 }
      );
    }

    // "html" is actually plain text → convert it
    const bodyHtml = convertToHtml(html || "");
    const finalHtml = emailTemplate(subject || "No Subject", bodyHtml);

    // Nodemailer
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.verify();

    // Send mail
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html: finalHtml,
      text: html, // plain fallback
    });

    // Save to Sanity
    const userId = req.headers.get("x-clerk-user-id") || "anonymous";
    await sanity.create({
      _type: "emailLog",
      userId,
      to,
      subject,
      preview: html?.slice(0, 200) || "",
      sentAt: new Date().toISOString(),
      providerInfo: info.messageId || null,
    });

    return NextResponse.json({ ok: true, info });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}