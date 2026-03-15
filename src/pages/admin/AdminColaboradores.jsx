import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { COLABORADORES } from "../../data/mockData.js";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { Avatar } from "../../components/Avatar";

const parseFunctionInvokeError = async (error, fallbackMessage) => {
  if (!error) return fallbackMessage;
  try {
    const context = error.context;
    if (context && typeof context.text === "function") {
      const raw = await context.text();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.error) return String(parsed.error);
          if (parsed?.message) return String(parsed.message);
        } catch (_err) {
          return raw;
        }
      }
    }
  } catch (_err) {
    // ignore and use fallback below
  }
  return error?.message || fallbackMessage;
};

const isJwtSessionError = (error) => {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("invalid jwt") || msg.includes("jwt expired") || msg.includes("session expired");
};

const ADMIN_COLABS_CACHE_KEY = "panet.admin.colaboradores.cache.v1";
const PAGE_SIZE = 20;

const readCachedAdminColaboradores = (queryKey) => {
  try {
    const raw = localStorage.getItem(ADMIN_COLABS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const entry = parsed[queryKey];
    if (!entry || typeof entry !== "object") return null;
    if (!Array.isArray(entry.rows)) return null;
    return {
      rows: entry.rows,
      total: Number(entry.total || 0),
    };
  } catch (_err) {
    return null;
  }
};

const writeCachedAdminColaboradores = (queryKey, rows, total) => {
  try {
    if (!queryKey || !Array.isArray(rows)) return;
    const raw = localStorage.getItem(ADMIN_COLABS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = parsed && typeof parsed === "object" ? parsed : {};
    next[queryKey] = {
      rows,
      total: Number(total || 0),
      at: Date.now(),
    };
    localStorage.setItem(ADMIN_COLABS_CACHE_KEY, JSON.stringify(next));
  } catch (_err) {
    // ignore cache failures
  }
};

const clearCachedAdminColaboradores = () => {
  try {
    localStorage.removeItem(ADMIN_COLABS_CACHE_KEY);
  } catch (_err) {
    // ignore cache failures
  }
};

const mapProfileToRow = (profile, currentUserId) => {
  const iniciais = profile.nome
    ?.split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return {
    id: profile.id,
    nome: profile.nome,
    cargo: profile.cargo,
    email: profile.email,
    telefone: profile.telefone || "",
    fotoUrl: profile.foto_url || "",
    cor: profile.cor_avatar || "#11E7E7",
    foto: iniciais || "U",
    perfil: profile.perfil || "colaborador",
    isMe: profile.id === currentUserId,
    redes: {
      instagram: profile.instagram || "",
      linkedin: profile.linkedin || "",
      github: profile.github || "",
    },
  };
};

export function AdminColaboradores() {
  const [lista, setLista] = useState(isSupabaseEnabled ? [] : COLABORADORES);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [senhaGerada, setSenhaGerada] = useState(null);
  const [senhaCopiada, setSenhaCopiada] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(isSupabaseEnabled ? 0 : COLABORADORES.length);
  const refreshTimerRef = useRef(null);
  const totalPages = Math.max(1, Math.ceil((totalItems || 0) / PAGE_SIZE));

  const getValidAccessToken = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (session?.access_token) return session.access_token;

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed?.session?.access_token) {
      throw new Error("Sessão expirada. Faça login novamente.");
    }
    return refreshed.session.access_token;
  }, []);

  const invokeAdminFunction = async (fnName, body, fallbackMessage) => {
    try {
      await getValidAccessToken();
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error || data?.error) {
        const parsedMessage = await parseFunctionInvokeError(error || data, fallbackMessage);
        throw new Error(parsedMessage || fallbackMessage);
      }
      return data || {};
    } catch (error) {
      const parsedMessage = await parseFunctionInvokeError(error, fallbackMessage);
      if (!isJwtSessionError({ message: parsedMessage }) && !isJwtSessionError(error)) {
        throw new Error(parsedMessage || fallbackMessage);
      }

      await getValidAccessToken();
      const { data: retriedData, error: retriedError } = await supabase.functions.invoke(fnName, { body });
      if (retriedError || retriedData?.error) {
        const retriedMessage = await parseFunctionInvokeError(retriedError || retriedData, fallbackMessage);
        throw new Error(retriedMessage || fallbackMessage);
      }
      return retriedData || {};
    }
  };

  const invokeDeleteCollaborator = useCallback(async (userId) => {
    const call = async () => {
      const accessToken = await getValidAccessToken();
      const { data, error } = await supabase.functions.invoke("delete-collaborator", {
        body: { user_id: userId },
        headers: {
          "x-client-jwt": accessToken,
        },
      });
      if (error || data?.error) {
        const parsedMessage = await parseFunctionInvokeError(error || data, "Não foi possível excluir o colaborador.");
        throw new Error(parsedMessage || "Não foi possível excluir o colaborador.");
      }
      return data || {};
    };

    try {
      return await call();
    } catch (err) {
      const msg = String(err?.message || "");
      if (!isJwtSessionError({ message: msg })) throw err;
      await supabase.auth.refreshSession();
      return call();
    }
  }, [getValidAccessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const normalized = String(searchInput || "").trim();
      setCurrentPage(1);
      setSearchTerm(normalized);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const carregarColaboradores = useCallback(async (options = {}) => {
    if (!isSupabaseEnabled) return;
    const { silent = false, force = false } = options;
    const normalizedSearch = String(searchTerm || "").trim();
    const queryKey = `${currentPage}|${normalizedSearch.toLowerCase()}`;
    const cachedPayload = !force ? readCachedAdminColaboradores(queryKey) : null;
    const showBlockingLoading = !silent && (!cachedPayload || cachedPayload.rows.length === 0);
    if (showBlockingLoading) setLoading(true);
    setErrorMsg("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const loggedUserId = session?.user?.id || null;

      if (!force && cachedPayload && cachedPayload.rows.length > 0) {
        setLista(cachedPayload.rows.map((row) => mapProfileToRow(row, loggedUserId)));
        setTotalItems(cachedPayload.total || cachedPayload.rows.length);
      }

      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("colaboradores")
        .select("id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github,perfil", { count: "exact" })
        .order("nome", { ascending: true })
        .range(from, to);
      if (normalizedSearch) {
        query = query.or(`nome.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%`);
      }
      const { data, error, count } = await query;
      if (error) throw error;

      writeCachedAdminColaboradores(queryKey, data || [], count || 0);
      setLista((data || []).map((row) => mapProfileToRow(row, loggedUserId)));
      setTotalItems(Number(count || 0));
    } catch (err) {
      if (!cachedPayload || cachedPayload.rows.length === 0) {
        setLista([]);
        setTotalItems(0);
        setErrorMsg(err?.message || "Não foi possível carregar colaboradores.");
      }
    } finally {
      if (showBlockingLoading) setLoading(false);
    }
  }, [currentPage, searchTerm]);

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
    setForm({
      nome: "",
      email: "",
      perfil: "colaborador",
    });
    setErrorMsg("");
    setModal("novo");
  };

  const abrirEditar = (col) => {
    setForm({ ...col });
    setErrorMsg("");
    setModal(col);
  };

  const salvar = async () => {
    if (!form.nome || !form.email) return;
    const normalizedEmail = String(form.email || "").trim().toLowerCase();
    if (!isSupabaseEnabled) {
      const duplicatedEmail = lista.some(
        (c) => String(c?.email || "").trim().toLowerCase() === normalizedEmail && (modal === "novo" || c.id !== form.id)
      );
      if (duplicatedEmail) {
        setErrorMsg("Já existe um colaborador com este e-mail.");
        return;
      }
    }

    const iniciais = form.nome
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    if (!isSupabaseEnabled) {
      if (modal === "novo") setLista((p) => [...p, { ...form, id: Date.now(), foto: iniciais, redes: {} }]);
      else setLista((p) => p.map((c) => (c.id === form.id ? { ...form, foto: iniciais } : c)));
      setModal(null);
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const { data: emailConflict, error: emailConflictError } = await supabase
        .from("colaboradores")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();
      if (emailConflictError) throw emailConflictError;
      if (emailConflict && (modal === "novo" || emailConflict.id !== form.id)) {
        throw new Error("Já existe um colaborador com este e-mail.");
      }

      if (modal === "novo") {
        const payload = {
          nome: form.nome,
          email: normalizedEmail,
          perfil: form.perfil === "admin" ? "admin" : "colaborador",
        };
        const data = await invokeAdminFunction("create-collaborator", payload, "Não foi possível criar o colaborador.");
        setSenhaGerada({
          email: data?.email || form.email,
          senha: data?.temporary_password || "",
          tipo: "alteracao",
        });
        setSenhaCopiada(false);
      } else {
        const { error } = await supabase
          .from("colaboradores")
          .update({
            nome: form.nome,
            email: normalizedEmail,
            perfil: form.perfil === "admin" ? "admin" : "colaborador",
          })
          .eq("id", form.id);
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
      await invokeDeleteCollaborator(colaborador.id);
      clearCachedAdminColaboradores();
      if (previousLista.length === 1 && currentPage > 1) {
        setCurrentPage((p) => Math.max(1, p - 1));
      }
      carregarColaboradores({ force: true, silent: true }).catch(() => {});
    } catch (err) {
      setLista(previousLista);
      setTotalItems(previousTotal);
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

      setSenhaGerada({
        email: data?.email || colaborador.email,
        senha: data?.temporary_password || "",
        tipo: "alteracao",
      });
      setSenhaCopiada(false);

      clearCachedAdminColaboradores();
      await carregarColaboradores({ force: true });
    } catch (err) {
      setErrorMsg(err?.message || "Não foi possível alterar a senha.");
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

  return (
    <div>
      <div className="admin-toolbar" style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
          <input
            className="search-input"
            style={{ minWidth: 240 }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
          />
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {loading ? "Sincronizando com Supabase..." : `${totalItems} colaborador(es)`}
          </div>
        </div>
        <button className="btn-primary" onClick={abrirNovo} disabled={loading}>
          + Novo colaborador
        </button>
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

      <div className="card">
        <div className="admin-table-wrap">
          <table className="admin-users-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Colaborador", "Cargo", "E-mail", "Nível", "Ações"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 11,
                      color: "var(--muted)",
                      fontWeight: 600,
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((col) => (
                <tr
                  key={col.id}
                  style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar col={col} size={32} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{col.nome}</div>
                        {col.isMe && <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700 }}>VOCÊ</span>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{col.cargo}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{col.email}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {col.perfil === "admin" ? (
                      <span
                        className="status-chip"
                        style={{
                          background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                          color: "var(--accent)",
                          border: "1px solid color-mix(in srgb, var(--accent) 36%, transparent)",
                        }}
                      >
                        Administrador
                      </span>
                    ) : (
                      <span className="status-chip status-marcado">Colaborador</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => abrirEditar(col)}>
                        Editar
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        onClick={() => alterarSenha(col)}
                        disabled={loading}
                      >
                        Alterar senha
                      </button>
                      {!col.isMe && (
                        <button
                          onClick={() => setConfirmarExcluir(col)}
                          style={{
                            background: "rgba(255,107,107,0.1)",
                            border: "1px solid rgba(255,107,107,0.3)",
                            color: "var(--danger)",
                            borderRadius: 6,
                            padding: "4px 10px",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && lista.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "18px 16px", color: "var(--muted)", fontSize: 13 }}>
                    Nenhum colaborador encontrado para o filtro atual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              className={`page-btn ${currentPage === i + 1 ? "active" : ""}`}
              onClick={() => setCurrentPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button className="page-btn" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            ›
          </button>
        </div>
      )}

      {modal !== null && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 640, width: "min(640px, calc(100vw - 40px))", margin: "0 auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
                {modal === "novo" ? "Novo colaborador" : "Editar colaborador"}
              </div>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">NOME COMPLETO *</label>
                <input
                  className="form-input"
                  value={form.nome || ""}
                  onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Ana Paula Ferreira"
                />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">E-MAIL CORPORATIVO *</label>
                  <input
                    className="form-input"
                    value={form.email || ""}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="nome@agenciapan.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">PERFIL</label>
                  <select
                    className="form-input"
                    value={form.perfil || "colaborador"}
                    onChange={(e) => setForm((p) => ({ ...p, perfil: e.target.value }))}
                  >
                    <option value="colaborador">Colaborador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              {modal === "novo" && (
                <div className="form-group">
                  <label className="form-label">SENHA TEMPORÁRIA</label>
                  <input className="form-input" type="text" value="Gerada automaticamente ao cadastrar" readOnly />
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    O colaborador será obrigado a trocar no primeiro acesso.
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn-ghost" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={salvar} disabled={loading}>
                  {modal === "novo" ? "Cadastrar" : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {senhaGerada && (
        <div
          className="modal-overlay"
          style={{ alignItems: "center", justifyItems: "center" }}
          onClick={() => {
            setSenhaGerada(null);
            setSenhaCopiada(false);
          }}
        >
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>Senha temporária gerada</div>
              <button className="modal-close" onClick={() => { setSenhaGerada(null); setSenhaCopiada(false); }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                Informe esta senha temporária ao colaborador. No próximo login, ele será obrigado a trocar para uma senha permanente.
              </div>
              <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{senhaGerada.email}</div>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 18 }}>{senhaGerada.senha}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <button className="btn-ghost" onClick={copiarSenha}>
                  {senhaCopiada ? "Copiado!" : "Copiar senha"}
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setSenhaGerada(null);
                    setSenhaCopiada(false);
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmarExcluir && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setConfirmarExcluir(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: "center", padding: 32 }}>
              <div style={{ marginBottom: 12, display: "inline-flex", color: "var(--danger)" }}><AlertTriangle size={36} /></div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Excluir colaborador?</div>
              <div style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
                <strong>{confirmarExcluir.nome}</strong> será removido(a) da Panet.
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn-ghost" onClick={() => setConfirmarExcluir(null)}>
                  Cancelar
                </button>
                <button
                  onClick={() => excluir(confirmarExcluir)}
                  style={{
                    background: "var(--danger)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                  disabled={loading}
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



