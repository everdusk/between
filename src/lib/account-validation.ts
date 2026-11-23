const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 5 || email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

export function passwordProblem(value: unknown): "short" | "long" | null {
  if (typeof value !== "string") return "short";
  if (value.length < 8) return "short";
  if (value.length > 200) return "long";
  return null;
}

/** Applied only when a password is first set or replaced. */
export function newPasswordProblem(value: unknown) {
  if (typeof value !== "string") return "short";
  const lengthProblem = passwordProblem(value);
  if (lengthProblem) return lengthProblem;
  return /\p{Nd}/u.test(value) && /[\p{P}\p{S}]/u.test(value) ? null : "composition";
}
