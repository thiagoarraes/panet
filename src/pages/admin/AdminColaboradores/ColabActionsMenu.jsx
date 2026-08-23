import { Dropdown, Label } from "@heroui/react";
import {
  History,
  KeyRound,
  MoreVertical,
  Pencil,
  Trash2,
  UserCheck,
  UserMinus,
} from "lucide-react";

// Menu de acoes por colaborador (kebab). Agrupa todas as acoes num unico
// dropdown rotulado, mantendo a coluna limpa.
//
// Antes isto era feito a mao: getBoundingClientRect para posicionar, portal
// manual, e quatro listeners (mousedown, Escape, scroll com capture, resize)
// so para fechar na hora certa. O Dropdown do HeroUI cobre tudo isso e ainda
// traz o que faltava: navegacao por setas, Home/End, busca por digitacao e
// reposicionamento automatico quando nao cabe na viewport.
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
  const isExPanner = col.ativo === false;

  const acoes = {
    senha: onAlterarSenha,
    editar: onAbrirEditar,
    historico: onVerHistorico,
    reativar: onReativar,
    desativar: onDesativar,
    excluir: onConfirmarExcluir,
  };

  return (
    <Dropdown>
      {/* Dropdown.Trigger e obrigatorio para um <button> nativo: sem ele o
          HeroUI nao injeta os handlers e o menu simplesmente nao abre. */}
      <Dropdown.Trigger>
        <button
          type="button"
          className="admin-action-icon"
          aria-label={`Ações de ${col.nome}`}
          disabled={loading}
          title="Ações"
        >
          <MoreVertical />
        </button>
      </Dropdown.Trigger>

      <Dropdown.Popover>
        <Dropdown.Menu onAction={(chave) => acoes[chave]?.(col)}>
          {!isExPanner && (
            <Dropdown.Item id="senha" textValue="Alterar senha">
              <KeyRound size={15} />
              <Label>Alterar senha</Label>
            </Dropdown.Item>
          )}
          <Dropdown.Item id="editar" textValue="Editar">
            <Pencil size={15} />
            <Label>Editar</Label>
          </Dropdown.Item>
          <Dropdown.Item id="historico" textValue="Histórico PanOff">
            <History size={15} />
            <Label>Histórico PanOff</Label>
          </Dropdown.Item>

          {!col.isMe && (
            <Dropdown.Section>
              {isExPanner ? (
                <Dropdown.Item id="reativar" textValue="Reativar acesso">
                  <UserCheck size={15} />
                  <Label>Reativar acesso</Label>
                </Dropdown.Item>
              ) : (
                <Dropdown.Item id="desativar" textValue="Tornar Ex Panner">
                  <UserMinus size={15} />
                  <Label>Tornar Ex Panner</Label>
                </Dropdown.Item>
              )}
              <Dropdown.Item id="excluir" textValue="Excluir permanentemente" variant="danger">
                <Trash2 size={15} />
                <Label>Excluir permanentemente</Label>
              </Dropdown.Item>
            </Dropdown.Section>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
