// "use client";

// import * as React from "react";
// import { useTheme } from "next-themes";
// // import { Button } from "@/components/ui/button";

// export function ModeToggle() {
//   const { setTheme, theme } = useTheme();

//   return (
//     <div
//       onClick={() => (theme === "light" ? setTheme("dark") : setTheme("light"))}
//       className="cursor-pointer border p-2"
//     >
//       <svg
//         xmlns="http://www.w3.org/2000/svg"
//         width="18"
//         height="18"
//         viewBox="0 0 24 24"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="2"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       >
//         <path stroke="none" d="M0 0h24v24H0z" fill="none" />
//         <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
//         <path d="M12 3l0 18" />
//         <path d="M12 9l4.65 -4.65" />
//         <path d="M12 14.3l7.37 -7.37" />
//         <path d="M12 19.6l8.85 -8.85" />
//       </svg>
//       <span className="sr-only">Toggle theme</span>
//     </div>
//   );
// }

"use client";

import { RiMoonClearLine, RiSunLine } from "@remixicon/react";
import { useTheme } from "next-themes";
import { useId } from "react";

export default function ThemeToggle() {
  const id = useId();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col justify-center">
      <input
        type="checkbox"
        name="theme-toggle"
        id={id}
        className="peer sr-only"
        checked={theme === "dark"}
        onChange={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle dark mode"
      />
      <label
        className="text-muted-foreground peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 relative inline-flex size-9 cursor-pointer items-center justify-center rounded-full transition-[color,box-shadow] outline-none peer-focus-visible:ring-[3px]"
        htmlFor={id}
        aria-hidden="true"
      >
        <RiSunLine className="dark:hidden" size={20} aria-hidden="true" />
        <RiMoonClearLine
          className="hidden dark:block"
          size={20}
          aria-hidden="true"
        />
        <span className="sr-only">Switch to light / dark version</span>
      </label>
    </div>
  );
}
