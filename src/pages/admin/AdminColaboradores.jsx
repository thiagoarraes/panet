import { useCallback, useEffect, useRef, useState } from "react";
import { COLABORADORES } from "../../data/mockData.js";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import {
  parseFunctionInvokeError,
  isJwtSessionError,
  invokeAdminFunctionHttp,
  PAGE_SIZE,
  escapePostgrestLike,
  readCachedAdminColaboradores,
  writeCachedAdminColaboradores,
  clearCachedAdminColaboradores,
  getBirthdayParts,
  toBirthdayIso,
  mapProfileToRow,
} from "../../lib/adminColabUtils.js";
import { ColabTable } from "./AdminColaboradores/ColabTable.jsx";
import { ColabModal } from "./AdminColaboradores/ColabModal.jsx";
import { SenhaModal } from "./AdminColaboradores/SenhaModal.jsx";
import { ConfirmarExcluirModal } from "./AdminColaboradores/ConfirmarExcluirModal.jsx";
import { ColabHistoricoModal } from "./AdminColaboradores/ColabHistoricoModal.jsx";
import { ConfirmarDesativarModal } from "./AdminColaboradores/ConfirmarDesativarModal.jsx";

export function AdminColaboradores({ initialColaboradores = [], currentUserId = null, isSuperAdmin = false, onDeleteColaborador }) {
  const [lista, setLista] = useState(() => {
    if (!isSupabaseEnabled) return COLABORADORES;
    if (!Array.isArray(initialColaboradores) || initialColaboradores.length === 0) return [];
    return initialColaboradores.map((row) => mapProfileToRow(row, currentUserId));
  });
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);
  const [confirmarDesativar, setConfirmarDesativar] = useState(null); // { col, action: "desativar"|"reativar" }
  const [historicoColab, setHistoricoColab] = useState(null);
  const [ativoFiltro, setAtivoFiltro] = useState("ativo"); // "ativo" | "ex_panner" | "todos"
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [senhaGerada, setSenhaGerada] = useState(null);
  const [senhaCopiada, setSenhaCopiada] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(() =>
    isSupabaseEnabled
      ? Array.isArray(initialColaboradores) ? initialColaboradores.length : 0
      : COLABORADORES.length
  );
  const refreshTimerRef = useRef(null);
  const totalPages = Math.max(1, Math.ceil((totalItems || 0) / PAGE_SIZE));

  const getValidAccessToken = useCallback(async () => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAt = Number(session?.expires_at || 0);
    if (Boolean(session?.access_token) && expiresAt > nowSec + 30) return session.access_token;
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed?.session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");
    return refreshed.session.access_token;
  }, []);

  const invokeAdminFunction = async (fnName, body, fallbackMessage) => {
    const run = (accessToken) => invokeAdminFunctionHttp(fnName, body, accessToken, fallbackMessage);
    try {
      return await run(await getValidAccessToken());
    } catch (error) {
      const parsedMessage = await parseFunctionInvokeError(error, fallbackMessage);
      if (!isJwtSessionError({ message: parsedMessage }) && !isJwtSessionError(error)) {
        throw new Error(parsedMessage || fallbackMessage);
      }
      try {
        return await run(await getValidAccessToken());
      } catch (finalErr) {
        const finalMessage = await parseFunctionInvokeError(finalErr, fallbackMessage);
        throw new Error(finalMessage || fallbackMessage);
      }
    }
  };

  const invokeDeleteCollaborator = useCallback(async (userId, email) => {
    const call = (accessToken) =>
      invokeAdminFunctionHttp("delete-collaborator", { user_id: userId, email }, accessToken, "Não foi possível excluir o colaborador.");
    try {
      return await call(await getValidAccessToken());
    } catch (err) {
      if (!isJwtSessionError({ message: String(err?.message || "") })) throw err;
      try {
        return await call(await getValidAccessToken());
      } catch (finalErr) {
        throw new Error(String(finalErr?.message || "") || "Não foi possível excluir o colaborador.");
      }
    }
  }, [getValidAccessToken]);

  const invokeDesativarColaborador = useCallback(async (userId, action) => {
    const fallback = action === "reactivate"
      ? "Não foi possível reativar o colaborador."
      : "Não foi possível desativar o colaborador.";
    const call = (accessToken) =>
      invokeAdminFunctionHttp("deactivate-collaborator", { user_id: userId, action }, accessToken, fallback);
    try {
      return await call(await getValidAccessToken());
    } catch (err) {
      if (!isJwtSessionError({ message: String(err?.message || "") })) throw err;
      try {
        return await call(await getValidAccessToken());
      } catch (finalErr) {
        throw new Error(String(finalErr?.message || "") || fallback);
      }
    }
  }, [getValidAccessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      setSearchTerm(String(searchInput || "").trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 and clear cache when the ativo filter changes
  useEffect(() => {
    setCurrentPage(1);
    clearCachedAdminColaboradores();
  }, [ativoFiltro]);

  useEffect(() => {
    if (!isSupabaseEnabled) return;
    if (!Array.isArray(initialColaboradores) || initialColaboradores.length === 0) return;
    setLista((prev) => (prev.length > 0 ? prev : initialColaboradores.map((row) => mapProfileToRow(row, currentUserId))));
    setTotalItems((prev) => (prev > 0 ? prev : initialColaboradores.length));
  }, [currentUserId, initialColaboradores]);

  const carregarColaboradores = useCallback(async (options = {}) => {
    if (!isSupabaseEnabled) return;
    const { silent = false, force = false } = options;
    const normalizedSearch = String(searchTerm || "").trim();
    const queryKey = `${currentPage}|${normalizedSearch.toLowerCase()}|${ativoFiltro}`;
    const cachedPayload = !force ? readCachedAdminColaboradores(queryKey) : null;
    const showBlockingLoading = !silent && (!cachedPayload || cachedPayload.rows.length === 0);
    if (showBlockingLoading) setLoading(true);
    setErrorMsg("");
    try {
      if (!force && cachedPayload && cachedPayload.rows.length > 0) {
        setLista(cachedPayload.rows.map((row) => mapProfileToRow(row, currentUserId)));
        setTotalItems(cachedPayload.total || cachedPayload.rows.length);
      }

      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let rowsQuery = supabase
        .from("colaboradores")
        .select("id,nome,cargo,aniversario,email,telefone,cor_avatar,foto_url,perfil,admin_modulos,ativo")
        .order("nome", { ascending: true })
        .range(from, to);
      let countQuery = supabase.from("colaboradores").select("id", { count: "exact", head: true });

      // ── Filtro ativo ────────────────────────────────────────────────────────
      if (ativoFiltro === "ativo") {
        rowsQuery = rowsQuery.eq("ativo", true);
        countQuery = countQuery.eq("ativo", true);
      } else if (ativoFiltro === "ex_panner") {
        rowsQuery = rowsQuery.eq("ativo", false);
        countQuery = countQuery.eq("ativo", false);
      }
      // "todos" → sem filtro

      if (normalizedSearch) {
        const safeSearch = escapePostgrestLike(normalizedSearch);
        const expr = `nome.ilike.*${safeSearch}*,email.ilike.*${safeSearch}*`;
        rowsQuery = rowsQuery.or(expr);
        countQuery = countQuery.or(expr);
      }

      const [{ data, error }, { count, error: countError }] = await Promise.all([rowsQuery, countQuery]);
      if (error) throw error;

      const rows = data || [];
      const fallbackTotal = Number(cachedPayload?.total || 0) || from + rows.length;
      const resolvedTotal = !countError && Number.isFinite(count) ? Number(count) : fallbackTotal;
      setTotalItems(Math.max(rows.length, resolvedTotal));
      setLista(rows.map((row) => mapProfileToRow(row, currentUserId)));
      writeCachedAdminColaboradores(queryKey, rows, resolvedTotal);
    } catch (err) {
      if (!cachedPayload || cachedPayload.rows.length === 0) {
        setLista([]);
        setTotalItems(0);
        setErrorMsg(err?.message || "Não foi possível carregar colaboradores.");
      }
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentUserId, searchTerm, ativoFiltro]);

  useEffect(() => {
    carregarColaboradores({ silent: true });
  }, [carregarColaboradores, currentPage, searchTerm]);

  useEffect(() => {
    if (!isSupabaseEnabled) return undefined;
    const channel = supabase
      .channel("admin-colaboradores-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "colaboradores" }, () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          carregarColaboradores({ silent: true, force: true }).catch(() => {});
        }, 250);
      })
      .subscribe();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      channel.unsubscribe();
    };
  }, [carregarColaboradores]);

  const abrirNovo = () => {
    setForm({ nome: "", cargo: "Colaborador", aniversario: "", aniversarioDia: "", aniversarioMes: "", email: "", perfil: "colaborador", adminModulos: null });
    setErrorMsg("");
    setModal("novo");
  };

  const abrirEditar = (col) => {
    const birthday = getBirthdayParts(col.aniversario);
    setForm({ ...col, adminModulos: col.adminModulos ?? null, aniversarioDia: birthday.aniversarioDia, aniversarioMes: birthday.aniversarioMes });
    setErrorMsg("");
    setModal(col);
  };

  const salvar = async () => {
    if (!form.nome || !form.email || !form.cargo) {
      setErrorMsg("Preencha nome, cargo e e-mail corporativo.");
      return;
    }
    const normalizedEmail = String(form.email || "").trim().toLowerCase();
    const normalizedCargo = String(form.cargo || "").trim() || "Colaborador";
    const hasBirthdayDay = Boolean(form.aniversarioDia);
    const hasBirthdayMonth = Boolean(form.aniversarioMes);
    if (hasBirthdayDay !== hasBirthdayMonth) {
      setErrorMsg("Preencha dia e mês do aniversário.");
      return;
    }
    const normalizedBirthday = toBirthdayIso(form.aniversarioDia, form.aniversarioMes);

    if (!isSupabaseEnabled) {
      const duplicatedEmail = lista.some(
        (c) => String(c?.email || "").trim().toLowerCase() === normalizedEmail && (modal === "novo" || c.id !== form.id)
      );
      if (duplicatedEmail) { setErrorMsg("Já existe um colaborador com este e-mail."); return; }
      const iniciais = form.nome.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
      const localPayload = { ...form, cargo: normalizedCargo, aniversario: normalizedBirthday || "" };
      if (modal === "novo") setLista((p) => [...p, { ...localPayload, id: Date.now(), foto: iniciais, redes: {} }]);
      else setLista((p) => p.map((c) => (c.id === form.id ? { ...localPayload, foto: iniciais } : c)));
      setModal(null);
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const { data: emailConflict, error: emailConflictError } = await supabase
        .from("colaboradores").select("id").eq("email", normalizedEmail).maybeSingle();
      if (emailConflictError) throw emailConflictError;
      if (emailConflict && (modal === "novo" || emailConflict.id !== form.id)) {
        throw new Error("Já existe um colaborador com este e-mail.");
      }

      if (modal === "novo") {
        const payload = {
          nome: form.nome, cargo: normalizedCargo, aniversario: normalizedBirthday,
          email: normalizedEmail, perfil: form.perfil === "admin" ? "admin" : "colaborador",
        };
        const data = await invokeAdminFunction("create-collaborator", payload, "Não foi possível criar o colaborador.");
        if (isSuperAdmin && form.perfil === "admin" && data?.user_id && form.adminModulos !== null) {
          await supabase.from("colaboradores").update({ admin_modulos: form.adminModulos }).eq("id", data.user_id);
        }
        setSenhaGerada({ email: data?.email || form.email, senha: data?.temporary_password || "", tipo: "alteracao" });
        setSenhaCopiada(false);
      } else {
        const updatePayload = {
          nome: form.nome, cargo: normalizedCargo, aniversario: normalizedBirthday,
          email: normalizedEmail, perfil: form.perfil === "admin" ? "admin" : "colaborador",
        };
        if (isSuperAdmin) {
          updatePayload.admin_modulos = form.perfil === "admin" ? (form.adminModulos ?? null) : null;
        }
        const { error } = await supabase.from("colaboradores").update(updatePayload).eq("id", form.id);
        if (error) throw error;
      }
      clearCachedAdminColaboradores();
      if (modal === "novo") setCurrentPage(1);
      await carregarColaboradores({ force: true });
      setModal(null);
    } catch (err) {
      setErrorMsg(err?.message || "Não foi possível salvar o colaborador.");
    } finally {
      setLoading(false);
    }
  };

  const excluir = async (colaborador) => {
    if (!isSupabaseEnabled) {
      setLista((p) => p.filter((c) => c.id !== colaborador.id));
      setConfirmarExcluir(null);
      return;
    }
    const previousLista = lista;
    const previousTotal = totalItems;
    setConfirmarExcluir(null);
    setLista((p) => p.filter((c) => c.id !== colaborador.id));
    setTotalItems((p) => Math.max(0, p - 1));
    setLoading(true);
    setErrorMsg("");
    try {
      await onDeleteColaborador?.(colaborador.id, { optimisticOnly: true });
      await invokeDeleteCollaborator(colaborador.id, colaborador.email);
      clearCachedAdminColaboradores();
      await onDeleteColaborador?.(colaborador.id);
      if (previousLista.length === 1 && currentPage > 1) setCurrentPage((p) => Math.max(1, p - 1));
      carregarColaboradores({ force: true, silent: true }).catch(() => {});
    } catch (err) {
      setLista(previousLista);
      setTotalItems(previousTotal);
      await onDeleteColaborador?.(null, { rollback: true });
      setErrorMsg(err?.message || "Não foi possível excluir o colaborador.");
    } finally {
      setLoading(false);
    }
  };

  const alterarSenha = async (colaborador) => {
    if (!isSupabaseEnabled) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await invokeAdminFunction("reset-password", { user_id: colaborador.id }, "Não foi possível alterar a senha.");
      setSenhaGerada({ email: data?.email || colaborador.email, senha: data?.temporary_password || "", tipo: "alteracao" });
      setSenhaCopiada(false);
      clearCachedAdminColaboradores();
      await carregarColaboradores({ force: true });
    } catch (err) {
      setErrorMsg(err?.message || "Não foi possível alterar a senha.");
    } finally {
      setLoading(false);
    }
  };

  const desativarOuReativar = async ({ col, action }) => {
    if (!isSupabaseEnabled) return;
    setConfirmarDesativar(null);
    const previousLista = lista;
    const previousTotal = totalItems;
    // Optimistic update: toggle ativo in the list
    setLista((p) => p.map((c) => c.id === col.id ? { ...c, ativo: action === "reativar" } : c));
    setLoading(true);
    setErrorMsg("");
    try {
      await invokeDesativarColaborador(col.id, action === "reativar" ? "reactivate" : "deactivate");
      clearCachedAdminColaboradores();
      carregarColaboradores({ force: true, silent: true }).catch(() => {});
    } catch (err) {
      setLista(previousLista);
      setTotalItems(previousTotal);
      setErrorMsg(err?.message || "Não foi possível alterar o status do colaborador.");
    } finally {
      setLoading(false);
    }
  };

  const copiarSenha = async () => {
    if (!senhaGerada?.senha) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(senhaGerada.senha);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = senhaGerada.senha;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setSenhaCopiada(true);
      setTimeout(() => setSenhaCopiada(false), 1800);
    } catch (_err) {
      setErrorMsg("Não foi possível copiar a senha.");
    }
  };

  const FILTRO_TABS = [
    { value: "ativo",     label: "Ativos" },
    { value: "ex_panner", label: "Ex Panners" },
    { value: "todos",     label: "Todos" },
  ];

  return (
    <div>
      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div
        className="admin-toolbar"
        style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
          <input
            className="search-input"
            style={{ minWidth: 240 }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
          />
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {loading ? "Sincronizando…" : `${totalItems} colaborador(es)`}
          </div>
        </div>
        <button className="btn-primary" onClick={abrirNovo} disabled={loading}>
          + Novo colaborador
        </button>
      </div>

      {/* ── Filtro Ativo / Ex Panner ──────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {FILTRO_TABS.map(({ value, label }) => {
          const active = ativoFiltro === value;
          return (
            <button
              key={value}
              onClick={() => setAtivoFiltro(value)}
              style={{
                padding: "5px 14px",
                borderRadius: 20,
                border: active
                  ? "1px solid color-mix(in srgb, var(--accent) 60%, transparent)"
                  : "1px solid var(--border)",
                background: active
                  ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                  : "transparent",
                color: active ? "var(--accent)" : "var(--muted)",
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,107,107,0.4)",
            background: "rgba(255,107,107,0.1)",
            color: "var(--danger)",
            fontSize: 13,
          }}
        >
          {errorMsg}
        </div>
      )}

      <ColabTable
        lista={lista}
        loading={loading}
        totalPages={totalPages}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        onAlterarSenha={alterarSenha}
        onAbrirEditar={abrirEditar}
        onConfirmarExcluir={setConfirmarExcluir}
        onVerHistorico={setHistoricoColab}
        onDesativar={(col) => setConfirmarDesativar({ col, action: "desativar" })}
        onReativar={(col) => setConfirmarDesativar({ col, action: "reativar" })}
      />

      {modal !== null && (
        <ColabModal
          modal={modal}
          form={form}
          setForm={setForm}
          errorMsg={errorMsg}
          loading={loading}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setModal(null)}
          onSalvar={salvar}
        />
      )}

      {senhaGerada && (
        <SenhaModal
          senhaGerada={senhaGerada}
          senhaCopiada={senhaCopiada}
          onCopiar={copiarSenha}
          onClose={() => { setSenhaGerada(null); setSenhaCopiada(false); }}
        />
      )}

      {confirmarExcluir && (
        <ConfirmarExcluirModal
          colaborador={confirmarExcluir}
          loading={loading}
          onClose={() => setConfirmarExcluir(null)}
          onConfirm={() => excluir(confirmarExcluir)}
        />
      )}

      {confirmarDesativar && (
        <ConfirmarDesativarModal
          colaborador={confirmarDesativar.col}
          action={confirmarDesativar.action}
          loading={loading}
          onClose={() => setConfirmarDesativar(null)}
          onConfirm={() => desativarOuReativar(confirmarDesativar)}
        />
      )}

      {historicoColab && (
        <ColabHistoricoModal
          colaborador={historicoColab}
          onClose={() => setHistoricoColab(null)}
        />
      )}
    </div>
  );
}
