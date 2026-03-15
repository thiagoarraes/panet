import { useCallback, useEffect, useState } from "react";
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

  const invokeAdminFunction = async (fnName, body, fallbackMessage) => {
    const getAccessToken = async () => {
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
    };

    try {
      const accessToken = await getAccessToken();
      const { data, error } = await supabase.functions.invoke(fnName, {
        body,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
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

      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed?.session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");
      const { data: retriedData, error: retriedError } = await supabase.functions.invoke(fnName, {
        body,
        headers: {
          Authorization: `Bearer ${refreshed.session.access_token}`,
        },
      });
      if (retriedError || retriedData?.error) {
        const retriedMessage = await parseFunctionInvokeError(retriedError || retriedData, fallbackMessage);
        throw new Error(retriedMessage || fallbackMessage);
      }
      return retriedData || {};
    }
  };

  const carregarColaboradores = useCallback(async () => {
    if (!isSupabaseEnabled) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("colaboradores")
        .select("id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github,perfil")
        .order("nome", { ascending: true });
      if (error) throw error;

      const loggedUserId = user?.id || null;
      setLista((data || []).map((row) => mapProfileToRow(row, loggedUserId)));
    } catch (err) {
      setLista([]);
      setErrorMsg(err?.message || "Não foi possível carregar colaboradores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarColaboradores();
  }, [carregarColaboradores]);

  useEffect(() => {
    if (!isSupabaseEnabled) return undefined;
    const channel = supabase
      .channel("admin-colaboradores-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "colaboradores" }, () => {
        carregarColaboradores().catch(() => {});
      })
      .subscribe();

    return () => {
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
    const duplicatedEmail = lista.some(
      (c) => String(c?.email || "").trim().toLowerCase() === normalizedEmail && (modal === "novo" || c.id !== form.id)
    );
    if (duplicatedEmail) {
      setErrorMsg("Já existe um colaborador com este e-mail.");
      return;
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
      if (modal === "novo") {
        const payload = {
          nome: form.nome,
          email: form.email,
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
            email: form.email,
            perfil: form.perfil === "admin" ? "admin" : "colaborador",
          })
          .eq("id", form.id);
        if (error) throw error;
      }
      await carregarColaboradores();
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

    setLoading(true);
    setErrorMsg("");
    try {
      await invokeAdminFunction("delete-collaborator", { user_id: colaborador.id }, "Não foi possível excluir o colaborador.");
      await carregarColaboradores();
      setConfirmarExcluir(null);
    } catch (err) {
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

      await carregarColaboradores();
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
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {loading ? "Sincronizando com Supabase..." : `${lista.length} colaborador(es)`}
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
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
          </tbody>
        </table>
      </div>

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


