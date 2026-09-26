// Email sending is pluggable specifically so this platform keeps working
// with `docker compose up` and zero external accounts by default (per the
// "no cloud account, no external API" self-hosting requirement), while
// still supporting real email delivery in production via env vars.
//
// EMAIL_PROVIDER controls which path runs:
//   - unset or "console" (default): logs the email to the server console
//     and returns the OTP code in the API response. This is NOT secure
//     for a real deployment — anyone who can see the HTTP response can
//     see the code — but it's the only way registration can work
//     out-of-the-box with no email account configured. Clearly labeled
//     wherever it's used, both here and in the UI.
//   - "smtp": sends via SMTP using SMTP_HOST/PORT/USER/PASS/FROM env vars.
//   - "brevo": sends via the Brevo transactional email API using
//     BREVO_API_KEY and EMAIL_FROM.

export type SendEmailResult = {
  delivered: boolean;
  devModeCode?: string; // only set when EMAIL_PROVIDER is "console"
};

export async function sendOtpEmail(to: string, code: string): Promise<SendEmailResult> {
  const provider = (process.env.EMAIL_PROVIDER ?? "console").toLowerCase();

  const subject = "Your Dogfood verification code";
  const text = `Your verification code is ${code}. It expires in 10 minutes.`;

  if (provider === "smtp") {
    return sendViaSmtp(to, subject, text);
  }
  if (provider === "brevo") {
    return sendViaBrevo(to, subject, text);
  }

  // Default: console/dev mode.
  console.log(`[dev email] To: ${to} | Subject: ${subject} | Code: ${code}`);
  return { delivered: true, devModeCode: code };
}

async function sendViaSmtp(to: string, subject: string, text: string): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM ?? user;

  if (!host || !user || !pass || !from) {
    console.error("[email] SMTP provider selected but SMTP_HOST/USER/PASS/EMAIL_FROM are not fully set.");
    return { delivered: false };
  }

  try {
    // Dynamically imported so `nodemailer` is only required when SMTP is
    // actually selected — the default console path has zero extra
    // dependencies to install for a self-hosted demo.
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transport.sendMail({ from, to, subject, text });
    return { delivered: true };
  } catch (err) {
    console.error("[email] SMTP delivery failed:", err instanceof Error ? err.message : err);
    return { delivered: false };
  }
}

async function sendViaBrevo(to: string, subject: string, text: string): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.error("[email] Brevo provider selected but BREVO_API_KEY/EMAIL_FROM are not set.");
    return { delivered: false };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify({
        sender: { email: from },
        to: [{ email: to }],
        subject,
        textContent: text
      })
    });
    return { delivered: res.ok };
  } catch (err) {
    console.error("[email] Brevo delivery failed:", err instanceof Error ? err.message : err);
    return { delivered: false };
  }
}
