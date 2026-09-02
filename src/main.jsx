// heroui.css vem primeiro so por legibilidade: ele carrega tudo dentro de
// @layer, e global.css fica fora de layer, entao vence independente da ordem.
import "./styles/heroui.css";
import "./styles/global.css";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, Toast } from "@heroui/react";
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
    {/* Locale do React Aria: define formato de data (dd/mm/aaaa), nomes de
        mes e dia da semana nos componentes de data do HeroUI. */}
    <I18nProvider locale="pt-BR">
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary mensagem="Não foi possível carregar o Panet. Recarregue a página.">
        <BrowserRouter><App /></BrowserRouter>
      </ErrorBoundary>
      {/* Fila unica de toasts. Fica na raiz, fora do ErrorBoundary e do
          AuthProvider, para continuar de pe mesmo se uma pagina quebrar.
          O HeroUI nao monta nenhum provider por conta propria. */}
      <Toast.Provider placement="bottom end" />
      {Devtools ? (
        <React.Suspense fallback={null}>
          <Devtools initialIsOpen={false} />
        </React.Suspense>
      ) : null}
    </QueryClientProvider>
    </I18nProvider>
  </React.StrictMode>
);
