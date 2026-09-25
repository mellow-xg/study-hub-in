"use client";

export const passwordRules = [
  { label: "At least 8 characters", test: (value) => value.length >= 8 },
  { label: "Uppercase letter", test: (value) => /[A-Z]/.test(value) },
  { label: "Lowercase letter", test: (value) => /[a-z]/.test(value) },
  { label: "Number", test: (value) => /\d/.test(value) },
  { label: "Special character", test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export function isStrongPassword(value) {
  return passwordRules.every((rule) => rule.test(value));
}

export default function PasswordChecklist({ password }) {
  const passed = passwordRules.filter((rule) => rule.test(password)).length;
  return <div className="password-checklist" aria-label="Password requirements">
    <div className="flex items-center justify-between gap-2 text-xs font-bold mb-2">
      <span>Password strength</span><span>{passed === 5 ? "Strong" : passed >= 3 ? "Getting there" : "Needs work"}</span>
    </div>
    <div className="password-strength-track" role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={5} aria-valuenow={passed}><span style={{ width: `${passed * 20}%` }} /></div>
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 mt-3">
      {passwordRules.map((rule) => {
        const valid = rule.test(password);
        return <li key={rule.label} className={valid ? "rule-valid" : "rule-pending"}>
          <span aria-hidden="true">{valid ? "✓" : "○"}</span> {rule.label}
        </li>;
      })}
    </ul>
  </div>;
}
