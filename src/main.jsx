import "./styles/global.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { initQueryPersistence } from "./lib/queryPersistence";
import App from "./App.jsx";

if (typeof window !== "undefined") {
  const RELOAD_FLAG = "panet:reloaded-after-chunk-error";
  window.addEventListener("vite:preloadError", () => {
    if (sessionStorage.getItem(RELOAD_FLAG) === "1") return;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    window.location.reload();
  });
  window.addEventListener("load", () => {
    sessionStorage.removeItem(RELOAD_FLAG);
  });
}

const Devtools =
  import.meta.env.DEV
    ? React.lazy(() =>
        import("@tanstack/react-query-devtools").then((module) => ({
          default: module.ReactQueryDevtools,
        }))
      )
    : null;

initQueryPersistence(queryClient);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {Devtools ? (
        <React.Suspense fallback={null}>
          <Devtools initialIsOpen={false} />
        </React.Suspense>
      ) : null}
    </QueryClientProvider>
  </React.StrictMode>
);
