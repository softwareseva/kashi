/** Light, dark or system theme; stored per browser. Put the inline script from `themeBootScript` in index.html to avoid a flash. */
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "@softwareseva/ui";

type Theme = "light" | "dark" | "system";
const KEY = "theme";
const read = (): Theme => { try { return (localStorage.getItem(KEY) as Theme) ?? "system"; } catch { return "system"; } };
const apply = (t: Theme) => document.documentElement.classList.toggle("dark", t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches));

export const themeBootScript = `try{var t=localStorage.getItem("${KEY}")||"system";if(t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(read);
  useEffect(() => {
    apply(theme);
    try { localStorage.setItem(KEY, theme); } catch { /* private mode */ }
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => theme === "system" && apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
  const dark = document.documentElement.classList.contains("dark");
  return <IconButton label={dark ? "Use light theme" : "Use dark theme"} icon={dark ? <Sun /> : <Moon />} onClick={() => setTheme(dark ? "light" : "dark")} />;
}
