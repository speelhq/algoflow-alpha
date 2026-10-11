import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PLANS } from "@/challenges";
import { t } from "@/i18n/t";
import { App } from "@/ui/app/App";
import { storedKeys } from "@/store/storage";
import { firstLaunchTarget } from "@/ui/app/firstLaunch";
import { startRouting } from "@/ui/app/route";
import "@/ui/theme.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

// index.html carries the same text statically for the pre-render tab title.
document.title = t("app.name");

// Checked once per load, before any store can write.
const first = firstLaunchTarget(window.location.hash, storedKeys(), PLANS);
if (first !== null) window.history.replaceState(null, "", first);
startRouting();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
