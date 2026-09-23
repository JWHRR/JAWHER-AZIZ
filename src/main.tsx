import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAppTime } from "@/lib/time";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

// Apply saved theme (always dark for now)
document.documentElement.classList.add("dark");

// Register service worker for offline shell caching + background notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Initialize accurate time from API non-blockingly
initAppTime().catch((err) => {
  console.warn("Time initialization non-fatal error:", err);
});

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
