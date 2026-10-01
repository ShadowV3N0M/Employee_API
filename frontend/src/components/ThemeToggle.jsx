import { useTheme } from "../theme";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${className}`}
      onClick={(e) => toggleTheme(e)}
      title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
      aria-label={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
      aria-pressed={isDark}
    >
      <div className="theme-toggle-track" aria-hidden="true">
        {/* Dark mode stars decoration */}
        <span className="theme-sky-star star-1">★</span>
        <span className="theme-sky-star star-2">✦</span>
        <span className="theme-sky-star star-3">•</span>

        {/* Light mode clouds decoration */}
        <span className="theme-sky-cloud cloud-1" />
        <span className="theme-sky-cloud cloud-2" />

        {/* Animated sliding thumb */}
        <div className={`theme-toggle-thumb ${isDark ? "is-dark" : "is-light"}`}>
          {isDark ? (
            <svg
              className="theme-icon theme-icon-moon"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
            </svg>
          ) : (
            <svg
              className="theme-icon theme-icon-sun"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4.2" fill="#f59f00" stroke="#d97706" />
              <line x1="12" y1="1.5" x2="12" y2="4" />
              <line x1="12" y1="20" x2="12" y2="22.5" />
              <line x1="4.22" y1="4.22" x2="6" y2="6" />
              <line x1="18" y1="18" x2="19.78" y2="19.78" />
              <line x1="1.5" y1="12" x2="4" y2="12" />
              <line x1="20" y1="12" x2="22.5" y2="12" />
              <line x1="4.22" y1="19.78" x2="6" y2="18" />
              <line x1="18" y1="6" x2="19.78" y2="4.22" />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}
