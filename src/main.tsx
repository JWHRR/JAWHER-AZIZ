import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAppTime } from "@/lib/time";

const savedTheme = localStorage.getItem("theme");
document.documentElement.classList.add("dark");

// Initialize accurate time from API before rendering if possible
initAppTime().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
