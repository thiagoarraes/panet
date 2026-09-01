import { ComboBox, Input, ListBox } from "@heroui/react";

/**
 * ComboBox estrito por id (sem allowsCustomValue) para escolher um
 * colaborador numa lista de ~30 nomes. Antes era um <select> nativo --
 * mesmo problema que o campo Banco tinha antes do ComboBox: lista longa,
 * sem busca, so scroll manual.
 *
 * Diferente do PanComboBox (texto livre): aqui o valor e sempre um id valido
 * da lista, entao so controla `selectedKey`/`onSelectionChange` -- o
 * ComboBox cuida sozinho do texto exibido e da filtragem por digitacao.
 */
export function PanColaboradorSelect({ label, value, onChange, colaboradores, placeholder = "Selecione...", isRequired }) {
  return (
    <ComboBox
      selectedKey={value || null}
      onSelectionChange={(key) => onChange(key ?? "")}
      isRequired={isRequired}
    >
      {label ? <label className="form-label">{label}</label> : null}
      <ComboBox.InputGroup>
        <Input className="form-input" placeholder={placeholder} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          {colaboradores.map((col) => (
            <ListBox.Item key={col.id} id={col.id} textValue={col.nome}>
              {col.nome}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
