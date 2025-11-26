import { NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    // JSON Schema (OpenAPI subset) for response
    const responseSchema = {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "Short email subject",
          maxLength: 120,
        },
        text: { type: "string", description: "Full email body" },
      },
      required: ["subject", "text"],
    };

    const body = {
      // contents must be an array; each item must have a non-empty parts array
      contents: [
        {
          parts: [
            {
              text: `You are a professional email writer.
Return a JSON object with exactly two fields: "subject" (short subject line) and "text" (full email body).
Output must be valid JSON only, nothing else.

User prompt: ${prompt}`,
            },
          ],
        },
      ],
      // IMPORTANT: put mime type + schema inside generationConfig (camelCase)
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        // optional config:
        maxOutputTokens: 800,
        candidateCount: 1,
      },
    };

    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      body,
      { headers: { "Content-Type": "application/json" } }
    );

    // Parse robustly from candidates → content → parts
    let subject = "";
    let text = "";

    const candidates = res.data?.candidates;
    if (Array.isArray(candidates) && candidates.length > 0) {
      const candidate = candidates[0];
      const parts = candidate?.content?.parts ?? candidate?.content ?? [];

      // Join parts into a single string
      const joined = Array.isArray(parts)
        ? parts
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((p: any) =>
              typeof p === "string" ? p : p?.text ?? JSON.stringify(p)
            )
            .join("\n")
            .trim()
        : typeof parts === "string"
        ? parts
        : "";

      // If API returned JSON string (as requested), parse:
      try {
        const parsed = JSON.parse(joined);
        if (parsed && typeof parsed === "object") {
          subject = (parsed.subject ?? "").toString().trim();
          text = (parsed.text ?? "").toString().trim();
        } else {
          text = joined;
        }
      } catch {
        // fallback: not JSON — return raw joined output
        text = joined;
      }
    }

    // final fallback: if empty, try older fields
    if (!text) {
      text =
        res.data?.text ??
        res.data?.output ??
        res.data?.choices?.[0]?.text ??
        "";
    }

    // heuristic subject if model didn't deliver
    if (!subject) {
      const lines = (text || "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      subject = lines.length > 0 ? lines[0].slice(0, 120) : "";
    }

    return NextResponse.json({ subject, text });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    // show the real API error body (safe) so you can fix the request
    if (err?.response?.data) {
      console.error(
        "Gemini API error:",
        JSON.stringify(err.response.data, null, 2)
      );
      return NextResponse.json(
        { error: "Gemini API error", details: err.response.data },
        { status: err.response.status || 500 }
      );
    }
    console.error(err?.message ?? err);
    return NextResponse.json(
      { error: err?.message ?? "generation failed" },
      { status: 500 }
    );
  }
}
