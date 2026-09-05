import { useMemo, useState } from "react";
import { Button, ListBox, Modal, Select, toast } from "@heroui/react";
import {
  AlertTriangle, Check, Eye, KeyRound,
  Pencil, Plus, Search, Trash2, UserCheck, Users, X,
} from "lucide-react";
import { Avatar } from "../../../components/Avatar";
import {
  useExcluirServicoPanPass,
  useSalvarServicoPanPass,
} from "../../../hooks/mutations/usePanPassMutations";
import "../../../styles/panpass.css";
import { PanTooltip } from "../../../components/ui/PanTooltip";

export const VAZIO = {
  id: null,
  nome: "",
  categoria: "",
  url_login: "",
  logo_url: "",
  usuario: "",
  senha: "",
  restrito_a: [],
  ativo: true,
};

// "totp"/"codigo_email" só aparecem em registros antigos de auditoria (a
// funcionalidade de MFA foi removida do PanPass — hoje só existe "senha").
export const ACAO = {
  senha: { label: "Senha", Icon: Eye },
  totp: { label: "Código TOTP (descontinuado)", Icon: KeyRound },
  codigo_email: { label: "Código por e-mail (descontinuado)", Icon: KeyRound },
};

// Frase natural da auditoria — sem badge de ação, já que hoje só existe
// "revelar senha". Os verbos de totp/codigo_email só aparecem em histórico.
export const ACAO_VERBO = {
  senha: "revelou a senha de",
  totp: "gerou o código de",
  codigo_email: "buscou o código de",
};

export const formatarData = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export const iniciais = (nome) =>
  (nome || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

export function StatTile({ Icon, valor, rotulo, tom }) {
  return (
    <div className={`pp-stat ${tom ? `is-${tom}` : ""}`}>
      <span className="pp-stat-icone"><Icon size={15} /></span>
      <div>
        <div className="pp-stat-valor">{valor}</div>
        <div className="pp-stat-rotulo">{rotulo}</div>
      </div>
    </div>
  );
}

// Substitui o `select multiple` (que ocupava seis linhas fixas) por dois modos:
// "toda a equipe" não gasta espaço nenhum; "escolher pessoas" abre chips com
// avatar e uma busca que só cresce conforme o uso.
export function SeletorColaboradores({ colaboradores, selecionados, onChange }) {
  const [busca, setBusca] = useState("");
  const restrito = selecionados.length > 0;

  const porId = useMemo(
    () => new Map(colaboradores.map((c) => [c.id, c])),
    [colaboradores],
  );

  const sugestoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return colaboradores
      .filter((c) => !selecionados.includes(c.id))
      .filter((c) => (termo ? c.nome.toLowerCase().includes(termo) : true))
      .slice(0, 24);
  }, [colaboradores, selecionados, busca]);

  const alternarModo = (paraRestrito) => {
    if (!paraRestrito) onChange([]);
    else if (selecionados.length === 0 && colaboradores[0]) onChange([colaboradores[0].id]);
  };

  return (
    <div className="pp-acesso">
      <div className="pp-mfa-grid is-duplo" role="radiogroup" aria-label="Quem pode acessar">
        <button
          type="button"
          role="radio"
          aria-checked={!restrito}
          className={`pp-mfa-card ${restrito ? "" : "is-ativa"}`}
          onClick={() => alternarModo(false)}
        >
          <span className="pp-mfa-card-icone"><Users size={16} /></span>
          <span className="pp-mfa-card-label">Toda a equipe</span>
          <span className="pp-mfa-card-desc">Todos os {colaboradores.length} colaboradores</span>
          {!restrito && <Check size={13} className="pp-mfa-card-check" />}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={restrito}
          className={`pp-mfa-card ${restrito ? "is-ativa" : ""}`}
          onClick={() => alternarModo(true)}
        >
          <span className="pp-mfa-card-icone"><UserCheck size={16} /></span>
          <span className="pp-mfa-card-label">Escolher pessoas</span>
          <span className="pp-mfa-card-desc">
            {restrito ? `${selecionados.length} com acesso` : "Restringir a alguns"}
          </span>
          {restrito && <Check size={13} className="pp-mfa-card-check" />}
        </button>
      </div>

      {restrito && (
        <div className="pp-mfa-painel">
          <div className="pp-mfa-painel-topo">
            <span className="pp-mfa-painel-label">
              Com acesso
              <span className="pp-badge-fmt">{selecionados.length}</span>
            </span>
            {selecionados.length > 0 && (
              <button type="button" className="pp-limpar-tudo" onClick={() => onChange([])}>
                limpar
              </button>
            )}
          </div>

          <div className="pp-chips-pessoas">
            {selecionados.map((id) => {
              const c = porId.get(id);
              if (!c) return null;
              return (
                <span key={id} className="pp-pessoa-chip">
                  <Avatar col={c} size={18} />
                  {c.nome}
                  <button
                    type="button"
                    className="pp-pessoa-remover"
                    aria-label={`Remover ${c.nome}`}
                    onClick={() => onChange(selecionados.filter((x) => x !== id))}
                  >
                    <X size={11} />
                  </button>
                </span>
              );
            })}
          </div>

          <div className="pp-busca pp-busca-pessoas">
            <Search size={13} />
            <input
              placeholder="Buscar colaborador..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {sugestoes.length > 0 ? (
            <ul className="pp-sugestoes">
              {sugestoes.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => { onChange([...selecionados, c.id]); setBusca(""); }}>
                    <Avatar col={c} size={22} />
                    <span className="pp-sugestao-nome">{c.nome}</span>
                    {c.cargo && <span className="pp-sugestao-cargo">{c.cargo}</span>}
                    <Plus size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="pp-ajuda">
              {busca ? "Ninguém encontrado com esse nome." : "Todo mundo já foi adicionado."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Combobox flutuante pro filtro de auditoria: mostra avatar+nome do
// selecionado no gatilho, painel com busca reaproveita o mesmo padrão de
// SeletorColaboradores (lista com avatar+nome+cargo).
export function FiltroColaborador({ colaboradores, selecionadoId, onChange }) {
  // O painel antigo era renderizado inline, sem portal: dentro da toolbar da
  // auditoria ficava sujeito ao overflow do conteiner. O Select usa popover em
  // portal, o que resolve o clipping, e traz navegacao por setas, Escape e
  // busca por digitacao -- antes so havia um listener de mousedown.
  //
  // Ficou Select e nao ComboBox: o ComboBox exige controlar selectedKey e
  // inputValue separadamente, e a busca explicita nao compensa essa
  // complexidade para uma lista deste tamanho, onde o typeahead do React Aria
  // ja resolve. O campo de busca dedicado saiu.
  const itens = useMemo(
    () => [{ id: "todos", nome: "Todos os colaboradores" }, ...colaboradores],
    [colaboradores],
  );

  const selecionado = colaboradores.find((c) => c.id === selecionadoId) || null;

  return (
    <Select
      className="pp-filtro-colab"
      value={selecionadoId ?? "todos"}
      onChange={(chave) => onChange(chave === "todos" ? null : chave)}
    >
      <Select.Trigger className="pp-filtro-colab-trigger">
        {selecionado ? (
          <>
            <Avatar col={selecionado} size={18} />
            <span>{selecionado.nome}</span>
          </>
        ) : (
          <>
            <Users size={14} />
            <span>Todos os colaboradores</span>
          </>
        )}
        <Select.Indicator />
      </Select.Trigger>

      <Select.Popover>
        <ListBox items={itens}>
          {(c) => (
            <ListBox.Item id={c.id} textValue={c.nome}>
              {c.id === "todos" ? (
                <span className="pp-filtro-colab-todos-icone"><Users size={14} /></span>
              ) : (
                <Avatar col={c} size={22} />
              )}
              <span className="pp-sugestao-nome">{c.nome}</span>
              {c.cargo && <span className="pp-sugestao-cargo">{c.cargo}</span>}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function ServicoModal({ inicial, colaboradores, onFechar }) {
  const salvar = useSalvarServicoPanPass();
  const [form, setForm] = useState(inicial);
  const [erro, setErro] = useState("");
  const editando = Boolean(inicial.id);

  const set = (campo) => (e) =>
    setForm((f) => ({
      ...f,
      [campo]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const submeter = (e) => {
    e.preventDefault();
    setErro("");
    salvar.mutate(form, {
      onSuccess: () => {
        toast.success(editando ? "Serviço atualizado" : "Serviço cadastrado", {
          description: form.nome,
        });
        onFechar();
      },
      // Erro fica inline: o modal continua aberto e a correcao e feita aqui.
      onError: (err) => setErro(err.message),
    });
  };

  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(aberto) => {
        if (!aberto) onFechar();
      }}
    >
      <Modal.Container scroll="inside">
        <Modal.Dialog className="pp-modal" style={{ maxWidth: 660, border: "1px solid var(--border)" }}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="pp-modal-icone"><KeyRound size={16} /></span>
              <div>
                <Modal.Heading style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
                  {editando ? "Editar serviço" : "Novo serviço"}
                </Modal.Heading>
                <div className="section-sub" style={{ fontSize: 11 }}>
                  A senha é cifrada no servidor e nunca volta para o navegador
                </div>
              </div>
            </div>
          </Modal.Header>

          <form onSubmit={submeter}>
            <Modal.Body>
          <div className="pp-fieldset">
            <div className="pp-fieldset-titulo">Identificação</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="pp-servico-nome">NOME *</label>
                <input id="pp-servico-nome" className="form-input" value={form.nome} onChange={set("nome")} required placeholder="Claude" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pp-servico-url-login">URL DE LOGIN</label>
                <input id="pp-servico-url-login" className="form-input" type="url" value={form.url_login} onChange={set("url_login")} placeholder="https://claude.ai/login" />
              </div>
            </div>
          </div>

          <div className="pp-fieldset">
            <div className="pp-fieldset-titulo">Credencial</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="pp-servico-usuario">LOGIN / E-MAIL *</label>
                <input id="pp-servico-usuario" className="form-input" value={form.usuario} onChange={set("usuario")} required />
              </div>
              <div className="form-group">
                <label className="form-label">
                  SENHA {editando ? "· vazio mantém a atual" : "*"}
                </label>
                <input
                  className="form-input"
                  type="password"
                  autoComplete="new-password"
                  value={form.senha}
                  onChange={set("senha")}
                  required={!editando}
                  placeholder={editando ? "••••••••" : ""}
                />
              </div>
            </div>
          </div>

          <div className="pp-fieldset">
            <div className="pp-fieldset-titulo">Quem pode acessar</div>
            <SeletorColaboradores
              colaboradores={colaboradores}
              selecionados={form.restrito_a}
              onChange={(ids) => setForm((f) => ({ ...f, restrito_a: ids }))}
            />

            <label className="pp-switch-linha" aria-label="Serviço ativo">
              <span className="pp-switch-texto">
                <span className="pp-switch-titulo">Serviço ativo</span>
                <span className="pp-switch-desc">
                  {form.ativo
                    ? "Aparece no PanPass para quem tem acesso."
                    : "Fica oculto no PanPass, mas o cadastro é preservado."}
                </span>
              </span>
              <span className="pp-switch">
                <input type="checkbox" checked={form.ativo} onChange={set("ativo")} />
                <span className="pp-switch-trilho"><span className="pp-switch-bolinha" /></span>
              </span>
            </label>
          </div>

          {erro && (
            <div className="pp-erro-box">
              <AlertTriangle size={14} />
              <span>{erro}</span>
            </div>
          )}
            </Modal.Body>

            <Modal.Footer>
              <Button type="button" variant="tertiary" onPress={onFechar}>
                Cancelar
              </Button>
              <Button type="submit" isDisabled={salvar.isPending}>
                {salvar.isPending ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar serviço"}
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export function ConfirmarExclusao({ servico, onFechar }) {
  const excluir = useExcluirServicoPanPass();
  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(aberto) => {
        if (!aberto) onFechar();
      }}
    >
      <Modal.Container>
        <Modal.Dialog style={{ maxWidth: 420, border: "1px solid var(--border)" }}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16 }}>
              Excluir serviço
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 4 }}>
              Excluir <strong>{servico.nome}</strong>? A credencial é apagada em definitivo.
            </p>
            <p className="section-sub" style={{ fontSize: 12 }}>
              O histórico de acessos é preservado para auditoria.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" slot="close">Cancelar</Button>
            <Button
              variant="danger"
              isDisabled={excluir.isPending}
              onPress={() =>
                excluir.mutate(servico.id, {
                  onSuccess: () => {
                    toast.success("Serviço excluído", { description: servico.nome });
                    onFechar();
                  },
                  // Antes a falha era silenciosa: o modal ficava aberto sem
                  // nenhuma indicacao de que a exclusao nao aconteceu.
                  onError: (err) =>
                    toast.danger("Não foi possível excluir", {
                      description: err?.message || "Tente novamente em instantes.",
                    }),
                })
              }
            >
              {excluir.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export function ServicoCard({ servico, onEditar, onExcluir }) {
  return (
    <article className={`pp-servico ${servico.ativo ? "" : "is-inativo"}`}>
      <div className="pp-servico-topo">
        {servico.logo_url ? (
          <img className="pp-servico-logo" src={servico.logo_url} alt="" width={38} height={38} />
        ) : (
          <span className="pp-servico-logo pp-servico-logo-vazio">{iniciais(servico.nome)}</span>
        )}
        <div className="pp-servico-id">
          <h3 className="pp-servico-nome">{servico.nome}</h3>
          {servico.categoria && <span className="pp-servico-cat">{servico.categoria}</span>}
        </div>
        <div className="pp-servico-acoes">
          <PanTooltip texto="Editar">
            <button className="pp-icon-btn" aria-label="Editar" onClick={() => onEditar(servico)}>
              <Pencil size={14} />
            </button>
          </PanTooltip>
          <PanTooltip texto="Excluir">
            <button className="pp-icon-btn is-perigo" aria-label="Excluir" onClick={() => onExcluir(servico)}>
              <Trash2 size={14} />
            </button>
          </PanTooltip>
        </div>
      </div>

      <div className="pp-servico-login">{servico.usuario}</div>

      <div className="pp-tags">
        <span className="pp-tag">
          <Users size={11} />
          {servico.restrito_a?.length ? `${servico.restrito_a.length} pessoa(s)` : "Toda a equipe"}
        </span>
        <span className={`pp-tag ${servico.ativo ? "is-ok" : "is-off"}`}>
          <span className="pp-ponto" /> {servico.ativo ? "Ativo" : "Inativo"}
        </span>
      </div>
    </article>
  );
}

