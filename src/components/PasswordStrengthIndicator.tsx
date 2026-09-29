"use client";

import { getPasswordCriteria } from "@/lib/password";

interface PasswordStrengthIndicatorProps {
  password: string;
  showChecklist?: boolean;
  className?: string;
}

export function PasswordStrengthIndicator({
  password,
  showChecklist = true,
  className = "",
}: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const criteria = getPasswordCriteria(password);

  const checklistItems = [
    { label: "At least 8 characters", met: criteria.minLength },
    { label: "One uppercase letter (A-Z)", met: criteria.hasUppercase },
    { label: "One lowercase letter (a-z)", met: criteria.hasLowercase },
    { label: "One number (0-9)", met: criteria.hasNumber },
    { label: "One special character (!@#$%...)", met: criteria.hasSpecial },
  ];

  return (
    <div className={`mt-2 space-y-2 text-xs ${className}`}>
      {/* Visual meter and label */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-1">
          {[1, 2, 3, 4, 5].map((level) => (
            <div
              key={level}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                level <= criteria.score
                  ? criteria.strengthColor
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
        <span
          className={`font-semibold transition-colors duration-200 ${
            criteria.score <= 1
              ? "text-rose-600"
              : criteria.score === 2
              ? "text-amber-600"
              : criteria.score === 3
              ? "text-yellow-600"
              : criteria.score === 4
              ? "text-blue-600"
              : "text-emerald-600"
          }`}
        >
          {criteria.strengthLabel}
        </span>
      </div>

      {/* Checklist items */}
      {showChecklist && (
        <div className="grid grid-cols-1 gap-1 pt-1 sm:grid-cols-2 text-slate-600">
          {checklistItems.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-1.5 transition-colors duration-150 ${
                item.met ? "text-emerald-600 font-medium" : "text-slate-400"
              }`}
            >
              <span className="text-sm">
                {item.met ? "✓" : "○"}
              </span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
