// server/contact.route.js
const express = require("express");
const nodemailer = require("nodemailer");

const router = express.Router();

function required(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function buildTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || "true") === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error("SMTP env vars missing (SMTP_HOST, SMTP_USER, SMTP_PASS).");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

router.post("/", async (req, res) => {
  try {
    const { topic, message } = req.body || {};
    if (!required(topic) || !required(message)) {
      return res.status(400).json({ ok: false, error: "Topic and message are required." });
    }

    const transporter = buildTransport();

    const from = process.env.MAIL_FROM || process.env.SMTP_USER;
    const to = process.env.MAIL_TO || process.env.SMTP_USER;

    const info = await transporter.sendMail({
      from,
      to,
      subject: `[Stocks Contact] ${topic}`.slice(0, 200),
      text: message,
    });

    return res.json({ ok: true, id: info.messageId || null });
  } catch (err) {
    console.error("[/api/contact] error:", err);
    return res.status(500).json({ ok: false, error: "Failed to send email." });
  }
});

module.exports = router;
