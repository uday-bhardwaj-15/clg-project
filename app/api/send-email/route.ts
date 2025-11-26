import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import sanityClient from "@sanity/client";

const sanity = sanityClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET || "production",
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
});

export async function POST(req: Request) {
  try {
    const { to, subject, html } = await req.json();

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // use TLS (STARTTLS)
      auth: {
        user: process.env.SMTP_USER, // your full gmail address
        pass: process.env.SMTP_PASS, // the App Password (16 chars)
      },
      tls: {
        ciphers: "TLSv1.2",
      },
    });

    // optional: verify connection
    await transporter.verify();
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    });

    // Record to Sanity: store the user id (if available via headers / Clerk), prompt/subject, recipient, and timestamp
    const userId = req.headers.get("x-clerk-user-id") || "anonymous";

    const doc = {
      _type: "emailLog",
      userId,
      to,
      subject,
      preview: html.slice(0, 120),
      sentAt: new Date().toISOString(),
      providerInfo: info.messageId || null,
    };

    await sanity.create(doc);

    // Optionally update a user record to increment count — simplistic approach:
    const userDocId = `user_${userId}`;
    try {
      await sanity
        .transaction()
        .createIfNotExists({
          _id: userDocId,
          _type: "user",
          userId,
          emailsSent: 0,
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .patch(userDocId, (p: any) =>
          p.setIfMissing({ emailsSent: 0 }).inc({ emailsSent: 1 })
        )
        .commit();
    } catch (err) {
      console.warn("Sanity user increment failed", err);
    }

    return NextResponse.json({ ok: true, info });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err.message || "send failed" },
      { status: 500 }
    );
  }
}
