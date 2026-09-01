import { ComboBox, Input, ListBox } from "@heroui/react";

/**
 * Envolve o ComboBox do HeroUI (Input + Trigger + Popover + ListBox), que
 * exige composicao repetida por instancia -- mesmo racional do PanDatePicker.
 *
 * `allowsCustomValue` deixa digitar um valor fora da lista (ex.: um banco
 * novo). Nao ha um passo separado de "cadastrar": o proprio valor digitado
 * e salvo no registro do colaborador, e passa a aparecer na lista para os
 * proximos cadastros assim que a query de sugestoes for invalidada -- o
 * "cadastro" e so o primeiro uso.
 */
export function PanComboBox({ label, value, onChange, options, placeholder, className }) {
  return (
    <ComboBox
      allowsCustomValue
      className={className}
      inputValue={value}
      onInputChange={onChange}
      // ComboBox tambem controla selectedKey; sem selecao propria (so texto),
      // limpar aqui evita o aviso de "controlled without onSelectionChange".
      selectedKey={null}
      onSelectionChange={(key) => {
        if (key != null) onChange(String(key));
      }}
    >
      {label ? <label className="form-label">{label}</label> : null}
      <ComboBox.InputGroup>
        <Input className="form-input" placeholder={placeholder} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          {options.map((opcao) => (
            <ListBox.Item key={opcao} id={opcao} textValue={opcao}>
              {opcao}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
