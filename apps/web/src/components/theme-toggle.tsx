import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../design-system/components/index.js";

type Theme = "light" | "dark";

function readInitialTheme(): Theme {
  const savedTheme = window.localStorage.getItem("luma-theme");

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("luma-theme", theme);
  }, [theme]);

  const isDark = theme === "dark";

  return (
    <Button
      aria-label={isDark ? "Usar tema claro" : "Usar tema escuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      size="icon"
      variant="ghost"
    >
      {isDark ? (
        <Sun aria-hidden="true" size={18} />
      ) : (
        <Moon aria-hidden="true" size={18} />
      )}
    </Button>
  );
}
