import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect } from "node:tls";

export const OTP_TTL_MS = 10 * 60 * 1000;

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

export function newOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** The code is the first thing in the subject, so it shows in the inbox list. */
export function otpSubject(code: string): string {
  return `${code} — код для Between`;
}

/** The code is the whole first line, so a mail app can select and copy it. */
export function otpBody(code: string): string {
  return [
    code,
    "",
    "Код для Between. Он действует 10 минут.",
    "Выделите строку с кодом выше и скопируйте её целиком.",
    "Тот же код написан в теме письма.",
    "Если вы не запрашивали код, ничего делать не нужно.",
  ].join("\n");
}

export function otpHtml(code: string): string {
  const safe = code.replace(/\D/g, "");
  return [
    `<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:0;margin:0 0 16px">${safe}</pre>`,
    `<p style="font-family:sans-serif;font-size:15px;line-height:1.5">Код для Between. Он действует 10 минут. Выделите цифры и скопируйте.</p>`,
    `<p style="font-family:sans-serif;font-size:15px;line-height:1.5">Тот же код написан в теме письма. Если вы не запрашивали код, ничего делать не нужно.</p>`,
  ].join("");
}

export const RESET_TTL_MS = 30 * 60 * 1000;

export function resetSubject(): string {
  return "Ссылка, чтобы задать пароль Between";
}

/** A link to choose a new password. The letter never contains a password. */
export function resetBody(url: string): string {
  return [
    "Чтобы задать новый пароль, откройте ссылку. Она действует 30 минут и сработает один раз.",
    "",
    url,
    "",
    "Пароль в письме не приходит. Если вы не просили ссылку, ничего делать не нужно.",
  ].join("\n");
}

export function resetHtml(url: string): string {
  const href = escapeHtml(url);
  return [
    `<p style="font-family:sans-serif;font-size:16px;line-height:1.5">Чтобы задать новый пароль, откройте ссылку. Она действует 30 минут и сработает один раз.</p>`,
    `<p style="margin:24px 0"><a href="${href}" style="font-family:sans-serif;font-size:16px;font-weight:700">Задать новый пароль</a></p>`,
    `<p style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:14px;line-height:1.5;word-break:break-all">${href}</p>`,
    `<p style="font-family:sans-serif;font-size:14px;line-height:1.5">Пароль в письме не приходит. Если вы не просили ссылку, ничего делать не нужно.</p>`,
  ].join("");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === '"') return "&quot;";
    return "&#39;";
  });
}

export function hashOtp(code: string, secret: string): string {
  return createHmac("sha256", secret).update(code).digest("hex");
}

export function otpMatches(code: string, secret: string, expected: string): boolean {
  const actual = hashOtp(code, secret);
  const left = Buffer.from(actual, "hex");
  const right = Buffer.from(expected, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function mailConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): MailConfig | null {
  const host = env.SMTP_HOST?.trim() ?? "";
  const user = env.SMTP_USER?.trim() ?? "";
  const password = env.SMTP_PASSWORD?.trim() ?? "";
  const from = env.MAIL_FROM?.trim() || user;
  if (!host || !user || !password || !from.includes("@")) return null;
  const port = Number(env.SMTP_PORT?.trim() || "465");
  if (!Number.isInteger(port) || port < 1) return null;
  return { host, port, secure: port === 465, user, password, from };
}

function encodeHeader(value: string): string {
  if (/^[\u0020-\u007e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function dotStuff(text: string): string {
  return text.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

type Reader = {
  read: () => Promise<string>;
  write: (line: string) => void;
  end: () => void;
};

function reader(socket: Socket): Reader {
  let buf = "";
  const pending: string[] = [];
  const waiters: Array<(line: string) => void> = [];
  const failers: Array<(error: Error) => void> = [];
  const push = (line: string) => {
    const waiter = waiters.shift();
    if (waiter) waiter(line);
    else pending.push(line);
  };
  socket.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    let idx = buf.indexOf("\n");
    while (idx >= 0) {
      push(buf.slice(0, idx).replace(/\r$/, ""));
      buf = buf.slice(idx + 1);
      idx = buf.indexOf("\n");
    }
  });
  socket.on("error", (error) => {
    const fail = failers.shift();
    if (fail) fail(error);
  });
  return {
    read: () => {
      const queued = pending.shift();
      if (queued !== undefined) return Promise.resolve(queued);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("smtp timeout")), 8000);
        waiters.push((line) => {
          clearTimeout(timer);
          resolve(line);
        });
        failers.push((error) => {
          clearTimeout(timer);
          reject(error);
        });
      });
    },
    write: (line) => {
      socket.write(`${line}\r\n`);
    },
    end: () => socket.end(),
  };
}

async function readReply(io: Reader): Promise<number> {
  let code = 0;
  for (;;) {
    const line = await io.read();
    const match = /^(\d{3})([ -])/.exec(line);
    if (!match) throw new Error("smtp reply");
    code = Number(match[1]);
    if (match[2] === " ") return code;
  }
}

async function expect(io: Reader, ok: number[]): Promise<void> {
  const code = await readReply(io);
  if (!ok.includes(code)) throw new Error(`smtp ${code}`);
}

function messageData(
  config: MailConfig,
  message: { to: string; subject: string; text: string; html?: string },
): string {
  const headers = [
    `From: ${config.from}`,
    `To: ${message.to}`,
    `Subject: ${encodeHeader(message.subject)}`,
    "MIME-Version: 1.0",
  ];
  if (!message.html) {
    return [...headers, "Content-Type: text/plain; charset=UTF-8", "", dotStuff(message.text), "."].join(
      "\r\n",
    );
  }
  const boundary = "between-alt";
  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    dotStuff(message.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    dotStuff(message.html),
    `--${boundary}--`,
    ".",
  ].join("\r\n");
}

export async function smtpSend(
  config: MailConfig,
  message: { to: string; subject: string; text: string; html?: string },
  connect?: () => Socket,
): Promise<void> {
  const socket =
    connect?.() ??
    (config.secure
      ? tlsConnect({ host: config.host, port: config.port, servername: config.host })
      : netConnect({ host: config.host, port: config.port }));
  const io = reader(socket);
  try {
    await expect(io, [220]);
    io.write("EHLO between");
    await expect(io, [250]);
    io.write("AUTH LOGIN");
    await expect(io, [334]);
    io.write(Buffer.from(config.user, "utf8").toString("base64"));
    await expect(io, [334]);
    io.write(Buffer.from(config.password, "utf8").toString("base64"));
    await expect(io, [235]);
    io.write(`MAIL FROM:<${config.from}>`);
    await expect(io, [250]);
    io.write(`RCPT TO:<${message.to}>`);
    await expect(io, [250]);
    io.write("DATA");
    await expect(io, [354]);
    socket.write(`${messageData(config, message)}\r\n`);
    await expect(io, [250]);
    io.write("QUIT");
  } finally {
    io.end();
  }
}

export async function sendOtpMail(to: string, code: string): Promise<boolean> {
  const config = mailConfigFromEnv();
  if (!config) return false;
  await smtpSend(config, {
    to,
    subject: otpSubject(code),
    text: otpBody(code),
    html: otpHtml(code),
  });
  return true;
}

/** Sends the link for choosing a new password. The password itself is not a parameter. */
export async function sendResetMail(to: string, url: string): Promise<boolean> {
  const config = mailConfigFromEnv();
  if (!config) return false;
  await smtpSend(config, {
    to,
    subject: resetSubject(),
    text: resetBody(url),
    html: resetHtml(url),
  });
  return true;
}
