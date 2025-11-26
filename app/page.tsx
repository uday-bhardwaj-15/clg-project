"use client";

import React, { useState } from "react";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";

export default function Page() {
  const { isSignedIn } = useUser();
  const [prompt, setPrompt] = useState(
    "Write a short professional email asking for an interview follow-up."
  );
  const [recipient, setRecipient] = useState("recipient@example.com");
  const [subject, setSubject] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  async function handleGenerateAndSend(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSending(true);
      setStatus("Generating email...");
      const genRes = await fetch("/api/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const genJson = await genRes.json();
      const generatedMail = genJson.text || "";
      const generatedSubject = genJson.subject || "";

      setGeneratedText(generatedMail);
      if (!subject) setSubject(generatedSubject);

      setStatus("Sending email...");
      const sendRes = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipient,
          subject: subject || generatedSubject || "Hello",
          html: generatedMail,
        }),
      });
      const sendJson = await sendRes.json();

      if (sendJson.ok) {
        setStatus("✅ Email sent and recorded");
      } else {
        setStatus("❌ Failed to send: " + (sendJson.error || "unknown"));
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setStatus("❌ Error: " + err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white p-8">
      <header className="flex flex-col md:flex-row items-center justify-between mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-sky-800 mb-4 md:mb-0">
          AI Tools
        </h1>
        <div className="flex items-center gap-4">
          {isSignedIn ? (
            <UserButton afterSignOutUrl="/" />
          ) : (
            <SignInButton>
              <button className="bg-sky-600 text-white px-4 py-2 rounded hover:bg-sky-700 transition">
                Sign In
              </button>
            </SignInButton>
          )}
        </div>
      </header>

      <section className="bg-white p-6 rounded-2xl shadow-lg border border-sky-100">
        <form onSubmit={handleGenerateAndSend} className="space-y-6">
          <label className="block">
            <span className="text-sm font-medium text-sky-700">
              Recipient Email
            </span>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-sky-200 px-4 py-2 focus:ring-2 focus:ring-sky-300 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-sky-700">
              Prompt for Gemini
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-sky-200 px-4 py-2 h-28 focus:ring-2 focus:ring-sky-300 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-sky-700">
              Subject (optional — autofilled from generation)
            </span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-sky-200 px-4 py-2 focus:ring-2 focus:ring-sky-300 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-sky-700">
              Generated Email
            </span>
            <textarea
              value={generatedText}
              readOnly
              className="mt-1 block w-full rounded-lg border border-sky-200 px-4 py-2 h-48 bg-sky-50 text-sky-900 focus:outline-none"
            />
          </label>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <button
              disabled={!isSignedIn || sending}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 shadow text-white ${
                sending
                  ? "bg-sky-400 cursor-not-allowed"
                  : "bg-sky-600 hover:bg-sky-700"
              } transition`}
            >
              {sending ? "Working..." : "Generate & Send"}
            </button>
            <div className="text-sm text-sky-600">{status}</div>
          </div>
        </form>
      </section>

      <section className="mt-6 text-sm text-sky-500">
        <p>
          No images are stored — only text prompts and counts are saved to
          Sanity.
        </p>
      </section>
    </main>
  );
}
