import { Dropdown, Label } from "@heroui/react";
import {
  History,
  IdCard,
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
  podeVerRh,
  onAlterarSenha,
  onAbrirEditar,
  onConfirmarExcluir,
  onVerHistorico,
  onAbrirDadosRh,
  onDesativar,
  onReativar,
}) {
  const isExPanner = col.ativo === false;

  const acoes = {
    senha: onAlterarSenha,
    editar: onAbrirEditar,
    historico: onVerHistorico,
    dadosRh: onAbrirDadosRh,
    reativar: onReativar,
    desativar: onDesativar,
    excluir: onConfirmarExcluir,
  };

  return (
    <Dropdown>
      {/* O Trigger JA renderiza um <button> proprio. Envolver outro <button>
          aqui dentro gerava HTML invalido e duas caixas com borda e fundo
          aninhadas -- o "quadrado dentro do quadrado". A classe da Panet vai
          no proprio Trigger. */}
      <Dropdown.Trigger
        className="admin-action-icon"
        aria-label={`Ações de ${col.nome}`}
        isDisabled={loading}
        title="Ações"
      >
        <MoreVertical />
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
          {podeVerRh && (
            <Dropdown.Item id="dadosRh" textValue="Dados RH">
              <IdCard size={15} />
              <Label>Dados RH</Label>
            </Dropdown.Item>
          )}

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
