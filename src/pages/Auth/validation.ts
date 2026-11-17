export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordStrength {
  /** 0 = empty, 1 = weak, 2 = fair, 3 = strong */
  score: 0 | 1 | 2 | 3;
  label: string;
}

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "" };
  let points = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) points++;
  if (password.length >= 12) points++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++;
  if (/\d/.test(password)) points++;
  if (/[^A-Za-z0-9]/.test(password)) points++;

  if (password.length < MIN_PASSWORD_LENGTH || points <= 2) return { score: 1, label: "Weak" };
  if (points <= 3) return { score: 2, label: "Fair" };
  return { score: 3, label: "Strong" };
}
