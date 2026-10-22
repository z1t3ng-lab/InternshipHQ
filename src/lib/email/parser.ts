import { createHash } from "node:crypto";
import { HttpError } from "../http";
function decodeBytes(bytes: Buffer, charset = "utf-8") {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return bytes.toString("utf8");
  }
}
function quotedPrintable(value: string) {
  return Buffer.from(
    value
      .replace(/=\r?\n/g, "")
      .replace(/=([\da-f]{2})/gi, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      ),
    "latin1",
  );
}
function decodeHeader(value: string) {
  return value.replace(
    /=\?([^?]+)\?([bq])\?([^?]*)\?=/gi,
    (_, charset, encoding, data) =>
      decodeBytes(
        encoding.toLowerCase() === "b"
          ? Buffer.from(data, "base64")
          : quotedPrintable(data.replace(/_/g, " ")),
        charset,
      ),
  );
}
function headersAndBody(raw: string) {
  const match = /\r?\n\r?\n/.exec(raw);
  if (!match) return { headers: {} as Record<string, string>, body: raw };
  const headerText = raw.slice(0, match.index).replace(/\r?\n[ \t]+/g, " ");
  const headers = Object.fromEntries(
    headerText.split(/\r?\n/).map((line) => {
      const i = line.indexOf(":");
      return i > 0
        ? [line.slice(0, i).toLowerCase(), line.slice(i + 1).trim()]
        : ["", ""];
    }),
  );
  return { headers, body: raw.slice(match.index + match[0].length) };
}
function mimeText(raw: string, depth = 0): string {
  if (depth > 8)
    throw new HttpError(
      400,
      "This email has too many nested parts. Paste its plain text instead.",
    );
  const { headers, body } = headersAndBody(raw),
    contentType = headers["content-type"] || "text/plain";
  if (/attachment/i.test(headers["content-disposition"] || "")) return "";
  if (/multipart\//i.test(contentType)) {
    const boundary = /boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i.exec(
      contentType,
    );
    if (!boundary)
      throw new HttpError(
        400,
        "The email has an invalid multipart boundary. Paste its plain text instead.",
      );
    const parts = body
      .split(`--${boundary[1] || boundary[2]}`)
      .slice(1)
      .filter((p) => !p.startsWith("--"));
    // Prefer text/plain to avoid duplicating multipart/alternative content.
    const plain = parts.filter((p) => /^content-type:\s*text\/plain/im.test(p));
    return (plain.length ? plain : parts)
      .map((p) => mimeText(p.replace(/^\r?\n/, ""), depth + 1))
      .filter(Boolean)
      .join("\n");
  }
  if (!/^text\/(plain|html)/i.test(contentType)) return "";
  const encoding = headers["content-transfer-encoding"] || "";
  const charset = /charset\s*=\s*"?([^;"\s]+)/i.exec(contentType)?.[1];
  let text = /base64/i.test(encoding)
    ? decodeBytes(Buffer.from(body.replace(/\s/g, ""), "base64"), charset)
    : /quoted-printable/i.test(encoding)
      ? decodeBytes(quotedPrintable(body), charset)
      : body;
  if (/text\/html/i.test(contentType))
    text = text
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/?(?:p|div|br|li)\b[^>]*>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#(\d+);/g, (_, n) => {
        const code = Number(n);
        return code <= 0x10ffff ? String.fromCodePoint(code) : " ";
      });
  return text.trim();
}
export function parseEmail(input: {
  subject?: string;
  sender?: string;
  body?: string;
  eml?: string;
}) {
  let subject = input.subject?.trim() || "Imported email",
    sender = input.sender?.trim() || "",
    body = input.body?.trim() || "";
  if (input.eml) {
    if (Buffer.byteLength(input.eml) > 1_000_000)
      throw new HttpError(
        413,
        "Import an email up to 1 MB, or paste its message text.",
      );
    const parsed = headersAndBody(input.eml);
    if (!parsed.headers.subject && !parsed.headers.from)
      throw new HttpError(
        400,
        "Choose a valid .eml file, or paste the message text.",
      );
    subject = decodeHeader(parsed.headers.subject || subject);
    sender = decodeHeader(parsed.headers.from || sender);
    body = mimeText(input.eml);
  }
  if (!body.trim())
    throw new HttpError(
      400,
      "No readable email text was found. Paste the message text instead.",
    );
  if (body.length > 100_000 || subject.length > 500 || sender.length > 500)
    throw new HttpError(
      413,
      "Use email text under 100,000 characters and a shorter subject or sender.",
    );
  const fingerprint = createHash("sha256")
    .update(
      [subject, sender, body]
        .map((s) => s.replace(/\s+/g, " ").trim())
        .join("\n"),
    )
    .digest("hex");
  const suggestion = suggestStatus(subject, body);
  return { subject, sender, body, fingerprint, ...suggestion };
}
export function suggestStatus(subject: string, body: string) {
  // Read only the newest unquoted message. No external service or instructions
  // embedded in email can perform actions. Conflicting evidence stays unresolved.
  const recent = body
    .split(
      /\n(?:On .+ wrote:|Le .+ a écrit\s*:|[- ]*Forwarded message[- ]*|[- ]*Original Message[- ]*)/i,
    )[0]
    .split(/\r?\n/)
    .filter((line) => !/^\s*>/.test(line))
    .join("\n");
  if (
    /unsubscribe|se désabonner|désinscription|job alert|alerte emploi/i.test(
      `${subject}\n${recent}`,
    )
  )
    return {
      proposedStatus: "",
      evidence:
        "This looks like a newsletter or job alert. No status was suggested.",
    };
  const rules = [
    [
      "Rejected",
      /(?:we (?:regret|are sorry) to inform|we (?:will not|won't) be (?:moving|proceeding)|not (?:been )?selected (?:for|to)|unfortunately.{0,90}(?:not|other candidates)|nous (?:avons le regret|ne donnerons pas suite)|candidature n['’]a pas été retenue)/i,
    ],
    [
      "Offer",
      /(?:pleased to offer you|delighted to offer you|offer (?:you|of employment)|nous (?:avons le plaisir|sommes heureux) de vous (?:offrir|proposer))/i,
    ],
    [
      "Interview",
      /(?:(?:invite|inviting) you (?:to|for) (?:an? |the |our )?interview|schedule (?:an? |your |the )?interview|interview (?:invitation|confirmed)|invitons à (?:un |une )?entretien|invitation (?:à|a) un entretien)/i,
    ],
    [
      "Assessment",
      /(?:(?:complete|take) (?:the |a |an |our )?(?:online |coding |technical )?(?:assessment|test)|invitons à (?:compléter|passer) (?:un |une |le |notre )?(?:test|évaluation))/i,
    ],
    [
      "Applied",
      /(?:thank you for (?:applying|your application)|(?:we have|we've) received your application|application (?:has been |was )?received|nous avons (?:bien )?reçu votre candidature|merci (?:pour votre candidature|d['’]avoir postulé))/i,
    ],
  ] as const;
  const input = `${subject}\n${recent}`;
  const matches = rules.flatMap(([status, pattern]) => {
    const m = pattern.exec(input);
    return m
      ? [
          {
            status,
            quote: input
              .slice(
                Math.max(0, input.lastIndexOf("\n", m.index) + 1),
                Math.min(
                  input.length,
                  input.indexOf("\n", m.index) === -1
                    ? input.length
                    : input.indexOf("\n", m.index),
                ),
              )
              .slice(0, 1000),
          },
        ]
      : [];
  });
  const decisive = matches.filter((m) => m.status !== "Applied");
  const chosen =
    decisive.length === 1
      ? decisive[0]
      : !decisive.length && matches.length === 1
        ? matches[0]
        : undefined;
  return chosen
    ? { proposedStatus: chosen.status, evidence: chosen.quote }
    : {
        proposedStatus: "",
        evidence: matches.length
          ? "Conflicting stage evidence. Choose the correct status after reading the email."
          : "No clear status evidence found. You can choose an update manually after reviewing the email.",
      };
}
