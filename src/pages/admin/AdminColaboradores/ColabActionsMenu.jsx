import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  History,
  KeyRound,
  MoreVertical,
  Pencil,
  Trash2,
  UserCheck,
  UserMinus,
} from "lucide-react";

// Menu de ações por colaborador (kebab). Agrupa todas as ações num único
// dropdown rotulado, mantendo a coluna limpa. Renderiza em portal com posição
// fixed para não ser cortado pelo overflow da tabela.
export function ColabActionsMenu({
  col,
  loading,
  onAlterarSenha,
  onAbrirEditar,
  onConfirmarExcluir,
  onVerHistorico,
  onDesativar,
  onReativar,
}) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const isExPanner = col.ativo === false;

  const posicionar = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const largura = 200;
    setPos({
      top: r.bottom + 6,
      left: Math.max(8, r.right - largura),
    });
  };

  useLayoutEffect(() => {
    if (aberto) posicionar();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = (e) => {
      if (
        !menuRef.current?.contains(e.target) &&
        !btnRef.current?.contains(e.target)
      ) {
        setAberto(false);
      }
    };
    const onKey = (e) => e.key === "Escape" && setAberto(false);
    const onScroll = () => setAberto(false);
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", fechar);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [aberto]);

  const acao = (fn) => () => {
    setAberto(false);
    fn?.(col);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`admin-action-icon ${aberto ? "is-active" : ""}`}
        onClick={() => setAberto((v) => !v)}
        aria-label={`Ações de ${col.nome}`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        disabled={loading}
        title="Ações"
      >
        <MoreVertical />
      </button>

      {aberto &&
        createPortal(
          <div
            ref={menuRef}
            className="colab-menu"
            role="menu"
            style={{ top: pos.top, left: pos.left }}
          >
            {!isExPanner && (
              <button className="colab-menu-item" role="menuitem" onClick={acao(onAlterarSenha)}>
                <KeyRound size={15} /> Alterar senha
              </button>
            )}
            <button className="colab-menu-item" role="menuitem" onClick={acao(onAbrirEditar)}>
              <Pencil size={15} /> Editar
            </button>
            <button className="colab-menu-item" role="menuitem" onClick={acao(onVerHistorico)}>
              <History size={15} /> Histórico PanOff
            </button>

            {!col.isMe && (
              <>
                <div className="colab-menu-sep" />
                {isExPanner ? (
                  <button className="colab-menu-item" role="menuitem" onClick={acao(onReativar)}>
                    <UserCheck size={15} /> Reativar acesso
                  </button>
                ) : (
                  <button className="colab-menu-item is-warn" role="menuitem" onClick={acao(onDesativar)}>
                    <UserMinus size={15} /> Tornar Ex Panner
                  </button>
                )}
                <button className="colab-menu-item is-danger" role="menuitem" onClick={acao(onConfirmarExcluir)}>
                  <Trash2 size={15} /> Excluir permanentemente
                </button>
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
