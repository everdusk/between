const reasons = [
  "bad_email", "taken", "short_password", "password_mismatch", "bad_login", "bad",
  "limited", "soon", "mail_off", "mail_fail", "server_not_configured", "bad_json",
  "max_off", "telegram_off", "bad_token", "unauthorized", "network_error",
  "server_error", "unexpected_response", "confirmation_timeout",
];

export const authOperations = ["register", "verify_code", "password_login", "forgot_password", "messenger_start", "messenger_wait", "max_auto_login"] as const;
export type AuthOperation = typeof authOperations[number];

export function registrationReason(code: unknown, status = 0): string {
  if (typeof code === "string" && reasons.includes(code)) return code;
  return status >= 500 ? "server_error" : "unexpected_response";
}
