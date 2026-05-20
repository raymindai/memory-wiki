/**
 * Email templates and sending functions via Resend API.
 * All emails use memory.wiki dark branding: #09090b bg, #18181b card, #27272a border, #fb923c accent.
 */

const FROM_ADDRESS = "memory.wiki <notifications@mdfy.app>";
const RESEND_API_URL = "https://api.resend.com/emails";

// ─── Shared template parts ───

function logoHtml(): string {
  return `<span style="font-weight:800;font-size:20px;letter-spacing:-0.5px"><span style="color:#fb923c">md</span><span style="color:#a1a1aa">fy</span></span>`;
}

function footerHtml(to: string): string {
  return `
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #27272a">
    <p style="margin:0;font-size:11px;color:#52525b;line-height:1.6">
      This email was sent by <a href="https://memory.wiki" style="color:#fb923c;text-decoration:none">memory.wiki</a> to ${to}.<br/>
      If you no longer wish to receive these emails, you can update your notification preferences in your account settings.
    </p>
  </div>`;
}

function wrapEmail(body: string, to: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#09090b">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;background:#09090b;color:#e4e4e7">
  <div style="margin-bottom:28px">${logoHtml()}</div>
  ${body}
  ${footerHtml(to)}
</div>
</body>
</html>`;
}

function ctaButton(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#fb923c;color:#0a0a0c;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;margin-top:4px">${text}</a>`;
}

function card(content: string): string {
  return `<div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:28px;color:#e4e4e7">${content}</div>`;
}

// ─── Send helper ───

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });
}

// ─── Welcome Email ───

export async function sendWelcomeEmail(to: string): Promise<void> {
  const subject = "Welcome to memory.wiki";

  const features = [
    { title: "Publish instantly", desc: "Paste or write Markdown and get a shareable URL in seconds. No account needed to start." },
    { title: "Share anywhere", desc: "Short URLs, QR codes, embed codes. Stay private until you publish, or share with specific people by email." },
    { title: "AI-powered tools", desc: "Auto-detect AI conversations, render diagrams, export to PDF. Markdown is the engine -- you do not need to learn it." },
  ];

  const featuresHtml = features
    .map(
      (f) =>
        `<div style="margin-bottom:16px">
          <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#fafafa">${f.title}</p>
          <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.5">${f.desc}</p>
        </div>`
    )
    .join("");

  const body = card(`
    <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#fafafa">Welcome to memory.wiki</p>
    <p style="margin:0 0 24px;font-size:14px;color:#a1a1aa;line-height:1.6">
      The fastest way from thought to shared document. Here is what you can do:
    </p>
    ${featuresHtml}
    <div style="margin-top:24px">${ctaButton("Open memory.wiki", "https://memory.wiki")}</div>
  `);

  const html = wrapEmail(body, to);
  await sendEmail(to, subject, html);
}

// ─── Share Email ───

export async function sendShareEmail(
  to: string,
  fromName: string,
  docTitle: string,
  docId: string
): Promise<void> {
  const subject = `${fromName} shared a document with you on memory.wiki`;
  const docUrl = `https://memory.wiki/${docId}`;

  const body = card(`
    <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#fafafa">${fromName} shared a document with you</p>
    <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.5">
      Document: <span style="color:#e4e4e7;font-weight:600">${escapeHtml(docTitle)}</span>
    </p>
    ${ctaButton("Open Document", docUrl)}
  `);

  const html = wrapEmail(body, to);
  await sendEmail(to, subject, html);
}

// ─── Edit Request Email ───

export async function sendEditRequestEmail(
  to: string,
  fromName: string,
  docTitle: string,
  docId: string
): Promise<void> {
  const subject = `${fromName} requested edit access on memory.wiki`;
  const docUrl = `https://memory.wiki/${docId}`;

  const body = card(`
    <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#fafafa">${fromName} requested edit access</p>
    <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.5">
      Document: <span style="color:#e4e4e7;font-weight:600">${escapeHtml(docTitle)}</span>
    </p>
    ${ctaButton("Open Document", docUrl)}
  `);

  const html = wrapEmail(body, to);
  await sendEmail(to, subject, html);
}

// ─── Weekly Digest Email (placeholder for later) ───

export async function sendWeeklyDigestEmail(
  to: string,
  docsCreated: number,
  totalViews: number,
  newShares: number
): Promise<void> {
  const subject = "Your memory.wiki weekly summary";

  const statRow = (label: string, value: string) =>
    `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #27272a">
      <span style="font-size:13px;color:#a1a1aa">${label}</span>
      <span style="font-size:14px;font-weight:700;color:#fafafa">${value}</span>
    </div>`;

  const body = card(`
    <p style="margin:0 0 20px;font-size:16px;font-weight:700;color:#fafafa">Your week on memory.wiki</p>
    ${statRow("Documents created", String(docsCreated))}
    ${statRow("Total views", totalViews.toLocaleString())}
    ${statRow("New shares", String(newShares))}
    <div style="margin-top:24px">${ctaButton("Open memory.wiki", "https://memory.wiki")}</div>
  `);

  const html = wrapEmail(body, to);
  await sendEmail(to, subject, html);
}

// ─── Template Previews (for admin dashboard) ───

export function getTemplatePreviews(): { name: string; subject: string; html: string }[] {
  const to = "user@example.com";
  return [
    {
      name: "Welcome",
      subject: "Welcome to memory.wiki",
      html: wrapEmail(card(`
        <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#fafafa">Welcome to memory.wiki</p>
        <p style="margin:0 0 24px;font-size:14px;color:#a1a1aa;line-height:1.6">
          The fastest way from thought to shared document. Here is what you can do:
        </p>
        <div style="margin-bottom:16px">
          <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#fafafa">Publish instantly</p>
          <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.5">Paste or write Markdown and get a shareable URL in seconds.</p>
        </div>
        <div style="margin-bottom:16px">
          <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#fafafa">Share anywhere</p>
          <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.5">Short URLs, QR codes, embed codes, password protection.</p>
        </div>
        <div style="margin-bottom:16px">
          <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#fafafa">AI-powered tools</p>
          <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.5">Polish, summarize, translate, and chat with your documents.</p>
        </div>
        <div style="margin-top:24px">${ctaButton("Open memory.wiki", "https://memory.wiki")}</div>
      `), to),
    },
    {
      name: "Document Shared",
      subject: "Alex shared a document with you on memory.wiki",
      html: wrapEmail(card(`
        <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#fafafa">Alex shared a document with you</p>
        <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.5">
          Document: <span style="color:#e4e4e7;font-weight:600">System Design: Real-Time Notification Service</span>
        </p>
        ${ctaButton("Open Document", "https://memory.wiki/abc123")}
      `), to),
    },
    {
      name: "Edit Request",
      subject: "Alex requested edit access on memory.wiki",
      html: wrapEmail(card(`
        <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#fafafa">Alex requested edit access</p>
        <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.5">
          Document: <span style="color:#e4e4e7;font-weight:600">Q2 2026 Revenue Analysis</span>
        </p>
        ${ctaButton("Open Document", "https://memory.wiki/def456")}
      `), to),
    },
    {
      name: "Weekly Digest",
      subject: "Your memory.wiki weekly summary",
      html: wrapEmail(card(`
        <p style="margin:0 0 20px;font-size:16px;font-weight:700;color:#fafafa">Your week on memory.wiki</p>
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #27272a">
          <span style="font-size:13px;color:#a1a1aa">Documents created</span>
          <span style="font-size:14px;font-weight:700;color:#fafafa">5</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #27272a">
          <span style="font-size:13px;color:#a1a1aa">Total views</span>
          <span style="font-size:14px;font-weight:700;color:#fafafa">142</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #27272a">
          <span style="font-size:13px;color:#a1a1aa">New shares</span>
          <span style="font-size:14px;font-weight:700;color:#fafafa">3</span>
        </div>
        <div style="margin-top:24px">${ctaButton("Open memory.wiki", "https://memory.wiki")}</div>
      `), to),
    },
  ];
}

// ─── Utility ───

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
