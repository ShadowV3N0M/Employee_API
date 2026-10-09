/**
 * Telephone / Mobile Calling Codes & Parsing Utilities
 */

export const COUNTRY_CODES = [
  { code: "+91", label: "🇮🇳 +91 (IN)", name: "India", digits: 10 },
  { code: "+1", label: "🇺🇸 +1 (US)", name: "USA/Canada", digits: 10 },
  { code: "+44", label: "🇬🇧 +44 (UK)", name: "UK", digits: 10 },
  { code: "+971", label: "🇦🇪 +971 (AE)", name: "UAE", digits: 9 },
  { code: "+65", label: "🇸🇬 +65 (SG)", name: "Singapore", digits: 8 },
  { code: "+61", label: "🇦🇺 +61 (AU)", name: "Australia", digits: 9 },
  { code: "+49", label: "🇩🇪 +49 (DE)", name: "Germany", digits: 10 },
  { code: "+33", label: "🇫🇷 +33 (FR)", name: "France", digits: 9 },
  { code: "+81", label: "🇯🇵 +81 (JP)", name: "Japan", digits: 10 },
  { code: "+966", label: "🇸🇦 +966 (SA)", name: "Saudi Arabia", digits: 9 },
  { code: "+974", label: "🇶🇦 +974 (QA)", name: "Qatar", digits: 8 },
  { code: "+968", label: "🇴🇲 +968 (OM)", name: "Oman", digits: 8 },
  { code: "+965", label: "🇰🇼 +965 (KW)", name: "Kuwait", digits: 8 },
  { code: "+977", label: "🇳🇵 +977 (NP)", name: "Nepal", digits: 10 },
  { code: "+880", label: "🇧🇩 +880 (BD)", name: "Bangladesh", digits: 10 },
  { code: "+94", label: "🇱🇰 +94 (LK)", name: "Sri Lanka", digits: 9 },
];

/**
 * Parses raw phone string into country code, custom code, and 10-digit mobile number.
 */
export function parsePhoneNumber(rawPhone) {
  if (!rawPhone || !String(rawPhone).trim()) {
    return { code: "+91", customCode: "", digits: "" };
  }
  const clean = String(rawPhone).trim();

  // Sort known codes by length descending so +971 matches before +97, etc.
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const item of sorted) {
    if (clean.startsWith(item.code)) {
      const rest = clean.slice(item.code.length).replace(/\D/g, "");
      return { code: item.code, customCode: "", digits: rest.slice(0, 10) };
    }
  }

  // If starts with custom '+' code like +353
  if (clean.startsWith("+")) {
    const match = clean.match(/^(\+\d{1,5})\s*(.*)$/);
    if (match) {
      const code = match[1];
      const rest = match[2].replace(/\D/g, "");
      return { code: "custom", customCode: code, digits: rest.slice(0, 10) };
    }
  }

  // If plain digits (e.g. 10 digits or 12 digits starting with 91)
  const onlyDigits = clean.replace(/\D/g, "");
  if (onlyDigits.length === 12 && onlyDigits.startsWith("91")) {
    return { code: "+91", customCode: "", digits: onlyDigits.slice(2, 12) };
  }
  return { code: "+91", customCode: "", digits: onlyDigits.slice(0, 10) };
}

/**
 * Combines country code and 10-digit number into a canonical format: '+91 9876543210'.
 */
export function formatFullPhone(countryCode, customCode, digits) {
  if (!digits || !String(digits).trim()) return null;
  const cleanDigits = String(digits).replace(/\D/g, "").slice(0, 10);
  if (!cleanDigits) return null;
  const activeCode = countryCode === "custom"
    ? (customCode && customCode.trim() ? customCode.trim() : "+91")
    : countryCode || "+91";
  return `${activeCode} ${cleanDigits}`;
}

