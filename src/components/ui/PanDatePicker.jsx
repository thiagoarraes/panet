import { Calendar, DateField, DatePicker } from "@heroui/react";
import { parseDate, parseDateTime } from "@internationalized/date";

/**
 * Envolve o DatePicker do HeroUI, que exige ~25 linhas de composicao por
 * instancia (DateField.Group, Input, Segment, Suffix, Trigger, Popover,
 * Calendar com Header/Grid/YearPicker). Sao 12 instancias no projeto -- sem
 * este wrapper seriam ~300 linhas de markup identico espalhadas pelos forms.
 *
 * A API de fora fala ISO string, que e como as datas ja trafegam na Panet
 * ("2026-08-23" ou "2026-08-23T14:30"), entao os call sites nao precisam
 * conhecer CalendarDate.
 */

/** ISO -> CalendarDate/CalendarDateTime. Aceita vazio e data invalida. */
export const isoParaData = (iso, comHora = false) => {
  if (!iso) return null;
  try {
    return comHora ? parseDateTime(String(iso).slice(0, 16)) : parseDate(String(iso).slice(0, 10));
  } catch {
    return null;
  }
};

/** CalendarDate/CalendarDateTime -> ISO. Devolve "" quando limpo. */
export const dataParaIso = (valor) => (valor ? valor.toString() : "");

export function PanDatePicker({
  label,
  value,
  onChange,
  minValue,
  maxValue,
  comHora = false,
  isDisabled,
  isRequired,
  placeholder,
  className,
  ...rest
}) {
  return (
    <DatePicker
      className={className}
      granularity={comHora ? "minute" : "day"}
      hourCycle={24}
      isDisabled={isDisabled}
      isRequired={isRequired}
      maxValue={isoParaData(maxValue, comHora)}
      minValue={isoParaData(minValue, comHora)}
      value={isoParaData(value, comHora)}
      onChange={(v) => onChange(dataParaIso(v))}
      {...rest}
    >
      {label ? <label className="form-label">{label}</label> : null}
      <DateField.Group fullWidth>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DatePicker.Popover>
        <Calendar aria-label={label || placeholder || "Selecionar data"}>
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.YearPickerGrid>
            <Calendar.YearPickerGridBody>
              {({ year }) => <Calendar.YearPickerCell year={year} />}
            </Calendar.YearPickerGridBody>
          </Calendar.YearPickerGrid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}
