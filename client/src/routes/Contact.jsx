// FILE: client/src/routes/Contact.jsx  (READY TO PASTE)

import React, { useMemo, useState } from "react";
import { useI18n } from "../i18n.jsx";

const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";

function getAccessKey() {
  const k = (import.meta.env.VITE_WEB3FORMS_KEY || "").trim();
  return k;
}
function getTo() {
  return (import.meta.env.VITE_WEB3FORMS_TO || "").trim();
}

export default function Contact() {
  const { lang, dir } = useI18n();

  const L = useMemo(
    () => ({
      en: {
        title: "Contact Us",
        intro: "Send us a message. We’ll receive it by email.",
        email: "Your Email",
        topic: "Topic",
        message: "Message",
        send: "Send",
        clear: "Clear",
        sent: "Message sent successfully.",
        sending: "Sending…",
        error: "Failed to send. Please try again.",
        emailInvalid: "Enter a valid email address.",
        missingKey: "Missing Web3Forms access key. Add VITE_WEB3FORMS_KEY in client/.env and restart.",
      },
      ar: {
        title: "اتصل بنا",
        intro: "أرسل رسالتك، وسيصلنا بريد إلكتروني بها.",
        email: "بريدك الإلكتروني",
        topic: "الموضوع",
        message: "نص الرسالة",
        send: "إرسال",
        clear: "مسح",
        sent: "تم إرسال الرسالة بنجاح.",
        sending: "جاري الإرسال…",
        error: "فشل الإرسال. حاول مرة أخرى.",
        emailInvalid: "الرجاء إدخال بريد إلكتروني صالح.",
        missingKey: "مفقود مفتاح Web3Forms. أضِف VITE_WEB3FORMS_KEY في ملف .env ثم أعد التشغيل.",
      },
    }),
    []
  )[lang] || {};

  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState({ ok: null, msg: "" });
  const [loading, setLoading] = useState(false);

  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  async function handleSend(e) {
    e.preventDefault();
    if (!validEmail(email)) {
      setState({ ok: false, msg: L.emailInvalid });
      return;
    }
    const key = getAccessKey();
    if (!key) {
      setState({ ok: false, msg: L.missingKey });
      return;
    }

    setLoading(true);
    setState({ ok: null, msg: "" });

    const form = new FormData();
    form.append("access_key", key);
    form.append("from_name", "Stocks App Contact");
    form.append("subject", `[Stocks Contact] ${topic}`.slice(0, 120));
    form.append("email", email);   // sender’s email
    form.append("message", message);

    const to = getTo();
    if (to) form.append("to", to); // optional override from env

    try {
      const res = await fetch(WEB3FORMS_ENDPOINT, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!json.success) throw new Error(json.message || `HTTP ${res.status}`);
      setState({ ok: true, msg: L.sent });
      setTopic(""); setMessage("");
    } catch (e) {
      setState({ ok: false, msg: `${L.error} (${e.message})` });
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setEmail(""); setTopic(""); setMessage("");
    setState({ ok: null, msg: "" });
  }

  return (
    <div style={{ padding: 20 }} dir={dir}>
      <div
        style={{
          background: "#111827",
          color: "#fff",
          borderRadius: 12,
          padding: "16px 18px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800 }}>{L.title}</div>
      </div>

      <form
        onSubmit={handleSend}
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "grid",
          gap: 12,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div style={{ color: "#6b7280", marginBottom: 8 }}>{L.intro}</div>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 700 }}>{L.email}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 700 }}>{L.topic}</span>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={L.topic}
            required
            minLength={3}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#fff",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 700 }}>{L.message}</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={L.message}
            rows={8}
            required
            minLength={5}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#fff",
              resize: "vertical",
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #111827",
              background: "#111827",
              color: "#fff",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.8 : 1,
            }}
          >
            {loading ? L.sending : L.send}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            {L.clear}
          </button>
        </div>

        {state.msg && (
          <div
            style={{
              color: state.ok ? "#065f46" : "#991b1b",
              background: state.ok ? "#ecfdf5" : "#fee2e2",
              border: `1px solid ${state.ok ? "#a7f3d0" : "#fecaca"}`,
              borderRadius: 8,
              padding: "8px 10px",
            }}
          >
            {state.msg}
          </div>
        )}
      </form>
      <footer
          style={{
            marginTop: 24,
            padding: "14px 4px",
            textAlign: "center",
            color: "#64748b",
            fontSize: 12,
          }}
          >
            © Trueprice.cash
        </footer>

    </div>
  );
}
