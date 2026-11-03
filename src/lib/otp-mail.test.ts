import assert from "node:assert/strict";
import { connect, createServer, type Server, type Socket } from "node:net";
import { describe, it } from "node:test";
import { hashOtp, mailConfigFromEnv, otpMatches, otpSubject, smtpSend } from "./otp-mail";

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });
}

describe("otp mail", () => {
  it("puts the code at the start of the subject", () => {
    assert.equal(otpSubject("048219"), "048219 — код для Between");
    assert.equal(otpSubject("048219").startsWith("048219"), true);
  });

  it("checks the code without keeping it", () => {
    const hash = hashOtp("048219", "secret");
    assert.equal(otpMatches("048219", "secret", hash), true);
    assert.equal(otpMatches("048218", "secret", hash), false);
    assert.equal(hash.includes("048219"), false);
  });

  it("needs a host, a user, and a from-address", () => {
    assert.equal(mailConfigFromEnv({}), null);
    assert.equal(
      mailConfigFromEnv({
        SMTP_HOST: "smtp.example",
        SMTP_USER: "bot@between-journal.ru",
        SMTP_PASSWORD: "secret",
      })?.from,
      "bot@between-journal.ru",
    );
  });

  it("sends the code in the subject over smtp", async () => {
    const received: string[] = [];
    const server = createServer((socket: Socket) => {
      socket.write("220 ready\r\n");
      socket.on("data", (chunk) => {
        const text = chunk.toString("utf8");
        received.push(text);
        const line = text.trim().split("\r\n").at(-1) ?? "";
        if (line.startsWith("EHLO")) socket.write("250 hello\r\n");
        else if (line === "AUTH LOGIN") socket.write("334 user\r\n");
        else if (line === Buffer.from("bot@between-journal.ru").toString("base64")) socket.write("334 pass\r\n");
        else if (line === Buffer.from("secret").toString("base64")) socket.write("235 ok\r\n");
        else if (line.startsWith("MAIL FROM") || line.startsWith("RCPT TO")) socket.write("250 ok\r\n");
        else if (line === "DATA") socket.write("354 go\r\n");
        else if (text.includes("\r\n.\r\n")) socket.write("250 queued\r\n");
      });
    });
    const port = await listen(server);
    try {
      await smtpSend(
        {
          host: "127.0.0.1",
          port,
          secure: false,
          user: "bot@between-journal.ru",
          password: "secret",
          from: "bot@between-journal.ru",
        },
        { to: "ada@example.com", subject: otpSubject("048219"), text: "Код для входа в Between: 048219" },
        () => connect({ host: "127.0.0.1", port }),
      );
    } finally {
      server.close();
    }
    const blob = received.join("");
    assert.match(blob, /Subject: =\?UTF-8\?B\?/);
    const encoded = /Subject: =\?UTF-8\?B\?([^?]+)\?=/.exec(blob)?.[1] ?? "";
    const subject = Buffer.from(encoded, "base64").toString("utf8");
    assert.equal(subject, "048219 — код для Between");
    assert.match(blob, /Код для входа в Between: 048219/);
  });
});
