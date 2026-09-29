/** Company-wide password policy. */
export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_HINT = `Min ${MIN_PASSWORD_LENGTH} chars with uppercase, lowercase, number & special character`;

export const PASSWORD_TOO_SHORT = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;

/** Password criteria breakdown for UI indicators */
export interface PasswordCriteria {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  score: number; // 0 to 5
  isValid: boolean;
  strengthLabel: "Too Weak" | "Weak" | "Fair" | "Good" | "Strong";
  strengthColor: string;
}

export function getPasswordCriteria(password: string): PasswordCriteria {
  const minLength = password.length >= MIN_PASSWORD_LENGTH;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);

  const checks = [minLength, hasUppercase, hasLowercase, hasNumber, hasSpecial];
  const score = checks.filter(Boolean).length;
  const isValid = score === 5;

  let strengthLabel: PasswordCriteria["strengthLabel"] = "Too Weak";
  let strengthColor = "bg-rose-500";

  if (score <= 1) {
    strengthLabel = "Too Weak";
    strengthColor = "bg-rose-500";
  } else if (score === 2) {
    strengthLabel = "Weak";
    strengthColor = "bg-amber-500";
  } else if (score === 3) {
    strengthLabel = "Fair";
    strengthColor = "bg-yellow-500";
  } else if (score === 4) {
    strengthLabel = "Good";
    strengthColor = "bg-blue-500";
  } else {
    strengthLabel = "Strong";
    strengthColor = "bg-emerald-500";
  }

  return {
    minLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
    score,
    isValid,
    strengthLabel,
    strengthColor,
  };
}

/** Validate password strength beyond just length. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return PASSWORD_TOO_SHORT;
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return "Password must contain at least one special character (!@#$%^&*...)";
  }
  return null; // valid
}

