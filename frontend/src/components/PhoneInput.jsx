import { COUNTRY_CODES, parsePhoneNumber } from "../phoneUtils";
import FieldError from "./FieldError";

/**
 * Reusable PhoneInput component with country code selector, optional custom code box,
 * and dedicated 10-digit mobile number input with live digit counter.
 */
export default function PhoneInput({
  countryCode,
  setCountryCode,
  customCode,
  setCustomCode,
  digits,
  setDigits,
  label = "Personal Mobile Phone",
  required = false,
  error = "",
  onBlur,
  id = "phone-input",
}) {
  const handleDigitsChange = (e) => {
    let val = e.target.value;
    // If user pasted a phone number starting with '+', parse it automatically
    if (val.trim().startsWith("+")) {
      const parsed = parsePhoneNumber(val);
      setCountryCode(parsed.code);
      if (parsed.customCode) setCustomCode(parsed.customCode);
      setDigits(parsed.digits);
      return;
    }
    // Filter non-digits and cap at 10 digits
    const digitsOnly = val.replace(/\D/g, "").slice(0, 10);
    setDigits(digitsOnly);
  };

  const handleCustomCodeChange = (e) => {
    let val = e.target.value.trim();
    if (val && !val.startsWith("+")) {
      val = "+" + val.replace(/\D/g, "");
    } else if (val) {
      val = "+" + val.slice(1).replace(/\D/g, "");
    }
    setCustomCode(val.slice(0, 5));
  };

  return (
    <div className="phone-input-group" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "var(--muted)", margin: 0 }}>
        <span>{label} {required && "*"}</span>
      </label>

      <div style={{ display: "flex", gap: "6px", alignItems: "stretch", width: "100%", flexWrap: "wrap" }}>
        {/* Country Code Dropdown */}
        <select
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          style={{
            width: countryCode === "custom" ? "88px" : "112px",
            flexShrink: 0,
            fontSize: "0.85rem",
            padding: "8px 6px",
          }}
          title="Select Country Calling Code"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
          <option value="custom">🌐 Other</option>
        </select>

        {/* Custom Country Code Box (when 'Other' is selected) */}
        {countryCode === "custom" && (
          <input
            type="text"
            value={customCode}
            onChange={handleCustomCodeChange}
            placeholder="+Code"
            style={{ width: "65px", flexShrink: 0, fontSize: "0.85rem", padding: "8px 6px" }}
            maxLength={6}
            title="Custom Country Calling Code (e.g. +353)"
          />
        )}

        {/* 10-Digit Mobile Number Box */}
        <div style={{ position: "relative", flex: "1 1 140px", minWidth: 0 }}>
          <input
            id={id}
            type="tel"
            inputMode="numeric"
            value={digits}
            onChange={handleDigitsChange}
            onBlur={onBlur}
            placeholder="10-digit mobile number"
            maxLength={10}
            required={required}
            className={error ? "input-error" : ""}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            style={{
              width: "100%",
              paddingRight: "48px",
              fontSize: "0.9rem",
            }}
          />
          <span
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "0.72rem",
              fontWeight: "600",
              color: digits.length === 10 ? "var(--ok, #2b8a3e)" : "var(--muted)",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {digits.length === 10 ? "✓ 10/10" : `${digits.length}/10`}
          </span>
        </div>
      </div>

      {error ? (
        <FieldError error={error} id={`${id}-error`} />
      ) : (
        <small
          style={{
            display: "block",
            fontSize: "0.74rem",
            marginTop: "1px",
            color: digits.length === 10 ? "var(--ok, #2b8a3e)" : "var(--muted)",
          }}
        >
          {digits.length === 10
            ? "✓ Valid 10-digit mobile number"
            : digits.length > 0
            ? `${10 - digits.length} more digit${10 - digits.length > 1 ? "s" : ""} required`
            : "Select country code (+91 default) and enter 10-digit number"}
        </small>
      )}
    </div>
  );
}

