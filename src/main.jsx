// heroui.css vem primeiro so por legibilidade: ele carrega tudo dentro de
// @layer, e global.css fica fora de layer, entao vence independente da ordem.
import "./styles/heroui.css";
import "./styles/global.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { initQueryPersistence } from "./lib/queryPersistence";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import App from "./App.jsx";

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
      <ErrorBoundary mensagem="Não foi possível carregar o Panet. Recarregue a página.">
        <App />
      </ErrorBoundary>
      {Devtools ? (
        <React.Suspense fallback={null}>
          <Devtools initialIsOpen={false} />
        </React.Suspense>
      ) : null}
    </QueryClientProvider>
  </React.StrictMode>
);
