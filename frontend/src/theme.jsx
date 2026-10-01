import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (saved === "dark" || saved === "light") return saved;
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Listen for system theme changes if user hasn't explicitly set preference in localStorage
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      const saved = localStorage.getItem("theme");
      if (!saved) {
        setThemeState(e.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const applyThemeWithTransition = (nextTheme, e) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      setThemeState(nextTheme);
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Calculate origin coordinates from the click event or toggle button
    let x = window.innerWidth / 2;
    let y = 40;

    if (e) {
      if (typeof e.clientX === "number" && typeof e.clientY === "number" && (e.clientX !== 0 || e.clientY !== 0)) {
        x = e.clientX;
        y = e.clientY;
      } else if (e.currentTarget && typeof e.currentTarget.getBoundingClientRect === "function") {
        const rect = e.currentTarget.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }
    }

    document.documentElement.style.setProperty("--theme-click-x", `${Math.round(x)}px`);
    document.documentElement.style.setProperty("--theme-click-y", `${Math.round(y)}px`);

    // 1. Native View Transitions API (Modern Chromium, Safari 18+)
    if (!prefersReducedMotion && typeof document.startViewTransition === "function") {
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = document.startViewTransition(() => {
        document.documentElement.setAttribute("data-theme", nextTheme);
        document.documentElement.style.colorScheme = nextTheme;
        localStorage.setItem("theme", nextTheme);
        setThemeState(nextTheme);
      });

      transition.ready
        .then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`
              ]
            },
            {
              duration: 520,
              easing: "cubic-bezier(0.4, 0, 0.2, 1)",
              pseudoElement: "::view-transition-new(root)"
            }
          );
        })
        .catch(() => {
          document.documentElement.setAttribute("data-theme", nextTheme);
          document.documentElement.style.colorScheme = nextTheme;
          localStorage.setItem("theme", nextTheme);
          setThemeState(nextTheme);
        });

      return;
    }

    // 2. Coordinated CSS Fallback Transition (Firefox & non-supporting environments)
    if (!prefersReducedMotion) {
      document.documentElement.classList.add("theme-transitioning");
      window.clearTimeout(window.__themeTransitionTimeout);
      window.__themeTransitionTimeout = window.setTimeout(() => {
        document.documentElement.classList.remove("theme-transitioning");
      }, 550);
    }

    document.documentElement.setAttribute("data-theme", nextTheme);
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem("theme", nextTheme);
    setThemeState(nextTheme);
  };

  const toggleTheme = (e) => {
    const next = theme === "dark" ? "light" : "dark";
    applyThemeWithTransition(next, e);
  };

  const setTheme = (newTheme, e) => {
    if (newTheme === "dark" || newTheme === "light") {
      applyThemeWithTransition(newTheme, e);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
