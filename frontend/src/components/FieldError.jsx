/**
 * Accessible field-level validation error message component.
 */
export default function FieldError({ error, id }) {
  if (!error) return null;

  return (
    <div
      id={id}
      className="field-error-msg"
      role="alert"
      aria-live="polite"
    >
      <svg
        className="field-error-icon"
        viewBox="0 0 20 20"
        fill="currentColor"
        width="14"
        height="14"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      <span>{error}</span>
    </div>
  );
}

