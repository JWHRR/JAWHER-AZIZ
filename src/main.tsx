import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAppTime } from "@/lib/time";

const savedTheme = localStorage.getItem("theme");
document.documentElement.classList.add("dark");

// Register service worker for background notification support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Initialize accurate time from API non-blockingly
initAppTime().catch((err) => {
  console.warn("Time initialization non-fatal error:", err);
});

createRoot(document.getElementById("root")!).render(<App />);
