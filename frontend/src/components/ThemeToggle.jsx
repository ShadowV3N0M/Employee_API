import { useTheme } from "../theme";

export default function ThemeToggle({ className = "", showLabel = true }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={`btn ghost theme-toggle-btn ${className}`}
      onClick={toggleTheme}
      title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
      aria-label={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        cursor: "pointer",
        padding: "6px 12px",
        fontWeight: "500",
        userSelect: "none",
      }}
    >
      <span style={{ fontSize: "1.05rem", lineHeight: 1 }}>{isDark ? "☀️" : "🌙"}</span>
      {showLabel && <span>{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
}
