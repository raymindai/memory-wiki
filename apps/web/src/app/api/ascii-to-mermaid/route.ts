import { NextRequest, NextResponse } from "next/server";
import https from "https";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 503 });
  }

  let body: { ascii: string; image?: string; context?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { ascii, image, context } = body;
  if (!ascii || typeof ascii !== "string") {
    return NextResponse.json({ error: "ascii text required" }, { status: 400 });
  }

  const prompt = `Convert this diagram into Mermaid code.

RULES:
- Output ONLY valid Mermaid code. No explanation, no markdown fences, no comments.
- Preserve ALL labels exactly as they appear in the input.
- For tree/hierarchy diagrams, use "graph TD" (top-down).
- For flowcharts with decisions, use "graph TD" with diamond nodes for conditions.
- For sequence diagrams, use "sequenceDiagram".
- For each node, include ALL text associated with it. If a node has sub-labels below it (like "Browser" with "Memory.Wiki" below), combine them: A["Browser<br/>Memory.Wiki"]
- Use descriptive node IDs (left of the bracket): A, B1, node_x. **IDs must be ASCII letters/digits/underscores only — no spaces, no punctuation, no slashes, no dots.**
- **CRITICAL: ALWAYS wrap node labels in double quotes**: \`A["any text"]\` not \`A[any text]\`. This prevents parse errors on labels containing \`{ } ( ) / | : . , < > # @ %\` or whitespace. NEVER write \`G[memory.wiki/{id}]\` — write \`G["memory.wiki/{id}"]\`.
- Edge labels also quoted: \`A -->|"label"| B\`.
- Preserve the exact connection structure — which nodes connect to which.
- If the diagram has colored or highlighted text, ignore the styling — just preserve the text.

EXAMPLE INPUT:
    Root
     │
  ┌──┴──┐
  A     B
  x     y

EXAMPLE OUTPUT:
graph TD
    Root["Root"] --> A["A<br/>x"]
    Root --> B["B<br/>y"]

Diagram to convert:
${ascii}${context ? `\n\nDocument context (for understanding meaning):\n${context.substring(0, 1500)}` : ""}`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];

    if (image) {
      // Upload image for vision understanding
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const imgBuffer = Buffer.from(base64Data, "base64");

      let fileUri = "";
      try {
        fileUri = await uploadToGemini(apiKey, imgBuffer);
      } catch { /* fallback to inline */ }

      if (fileUri) {
        parts.push({ fileData: { mimeType: "image/png", fileUri } });
      } else {
        parts.push({ inlineData: { mimeType: "image/png", data: base64Data } });
      }
      parts.push({ text: prompt + "\n\nThe image shows the visual layout. Use it to understand spatial relationships. The text above is the raw source for exact labels." });
    } else {
      parts.push({ text: prompt });
    }

    const data = await geminiGenerate(apiKey, parts);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawText = (data as any).candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Clean up: remove code fences if present
    let mermaidCode = rawText
      .replace(/^```mermaid\n?/gm, "")
      .replace(/^```\n?/gm, "")
      .replace(/Here is.*:\n?/gi, "")
      .trim();

    // Validate it looks like Mermaid code
    if (!mermaidCode || (!mermaidCode.startsWith("graph") && !mermaidCode.startsWith("flowchart") && !mermaidCode.startsWith("sequenceDiagram") && !mermaidCode.startsWith("gantt") && !mermaidCode.startsWith("pie") && !mermaidCode.startsWith("classDiagram") && !mermaidCode.startsWith("stateDiagram"))) {
      // Try to extract mermaid from the response
      const match = rawText.match(/(graph\s+(?:TD|LR|TB|BT|RL)[\s\S]+?)(?:```|$)/);
      if (match) {
        mermaidCode = match[1].trim();
      } else {
        console.error("Invalid Mermaid output:", rawText?.substring(0, 300));
        return NextResponse.json({ error: "Failed to generate valid Mermaid code" }, { status: 500 });
      }
    }

    // Return mermaid code — client will render with mermaid.js
    return NextResponse.json({ mermaid: mermaidCode });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Gemini request failed:", msg);
    return NextResponse.json({ error: `AI request failed: ${msg}` }, { status: 500 });
  }
}

// ─── Helpers ───

async function uploadToGemini(apiKey: string, imgBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const startBody = JSON.stringify({ file: { displayName: "ascii-diagram.png" } });
    const startReq = https.request({
      hostname: "generativelanguage.googleapis.com",
      path: `/upload/v1beta/files?key=${apiKey}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(imgBuffer.length),
        "X-Goog-Upload-Header-Content-Type": "image/png",
      },
      family: 4,
    }, (res) => {
      const uploadUrl = res.headers["x-goog-upload-url"] as string;
      if (!uploadUrl) { reject(new Error("No upload URL")); return; }
      res.resume();
      res.on("end", () => {
        const parsed = new URL(uploadUrl);
        const uploadReq = https.request({
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          method: "PUT",
          headers: {
            "Content-Length": String(imgBuffer.length),
            "X-Goog-Upload-Offset": "0",
            "X-Goog-Upload-Command": "upload, finalize",
          },
          family: 4,
        }, (uploadRes) => {
          let body = "";
          uploadRes.on("data", (d: Buffer) => body += d.toString());
          uploadRes.on("end", () => {
            try {
              const result = JSON.parse(body);
              resolve(result.file?.uri || "");
            } catch { reject(new Error("Upload parse failed")); }
          });
        });
        uploadReq.on("error", reject);
        uploadReq.setTimeout(15000, () => { uploadReq.destroy(); reject(new Error("Upload timeout")); });
        uploadReq.write(imgBuffer);
        uploadReq.end();
      });
    });
    startReq.on("error", reject);
    startReq.setTimeout(10000, () => { startReq.destroy(); reject(new Error("Start timeout")); });
    startReq.write(startBody);
    startReq.end();
  });
}

async function geminiGenerate(apiKey: string, parts: unknown[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const reqBody = JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    });

    const req = https.request({
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(reqBody) },
      family: 4,
    }, (res) => {
      let body = "";
      res.on("data", (d: Buffer) => body += d.toString());
      res.on("end", () => {
        try {
          if (res.statusCode !== 200) {
            console.error("Gemini API error:", res.statusCode, body.substring(0, 200));
            reject(new Error(`Gemini API ${res.statusCode}`));
            return;
          }
          resolve(JSON.parse(body));
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.write(reqBody);
    req.end();
  });
}
