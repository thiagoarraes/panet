import {
  ENERGY_COLORS,
  MAX_MOOD_TAGS,
  MOOD_TAGS,
  getEnergyGlyph,
  getEnergyLabel,
} from "../../lib/dashboardMood";

const ENERGY_MIN = 1;
const ENERGY_MAX = 10;

const getEnergySegmentStyle = (color) => ({
  background: `linear-gradient(180deg, color-mix(in srgb, ${color} 86%, #ffffff), ${color})`,
  borderColor: `color-mix(in srgb, ${color} 44%, transparent)`,
  boxShadow: `0 12px 22px color-mix(in srgb, ${color} 24%, transparent)`,
});

/**
 * Passo 2: energia + tags.
 *
 * A energia usa um <input type="range"> nativo sobreposto a uma trilha de 10
 * segmentos decorativos. Os segmentos eram 10 botoes: semanticamente errado
 * para um valor unico e 10 paradas de tab. O range nativo entrega setas,
 * Home/End, PageUp/Down, arrasto por toque e leitura correta no leitor de tela
 * ("slider, Animada, 7 de 10") sem codigo proprio.
 */
export function MoodStepEnergy({
  draft,
  disabled = false,
  isPending = false,
  submitError = "",
  onChangeEnergy,
  onToggleTag,
  onBack,
  onSubmit,
}) {
  const isAtTagCap = draft.tags.length >= MAX_MOOD_TAGS;

  return (
    <div className="mood-panel">
      <div className="mood-panel-head">
        <div>
          <div className="mood-panel-eyebrow">Nível de energia</div>
          <h3 className="mood-energy-title">
            <span className="mood-energy-title-glyph" key={draft.energy} aria-hidden="true">
              {getEnergyGlyph(draft.energy)}
            </span>
            <span className="mood-energy-title-text">{getEnergyLabel(draft.energy)}</span>
          </h3>
        </div>
        <button type="button" className="btn-ghost mood-inline-button" onClick={onBack}>
          Voltar
        </button>
      </div>

      <div className="mood-energy-block">
        <div className="mood-energy-control">
          <input
            type="range"
            className="mood-energy-range"
            min={ENERGY_MIN}
            max={ENERGY_MAX}
            step={1}
            value={draft.energy}
            disabled={disabled}
            aria-label="Nível de energia"
            aria-valuetext={`${draft.energy} de ${ENERGY_MAX} — ${getEnergyLabel(draft.energy)}`}
            onChange={(event) => onChangeEnergy(Number(event.target.value))}
          />
          <div className="mood-energy-track" aria-hidden="true">
            {Array.from({ length: ENERGY_MAX }, (_, index) => {
              const value = index + 1;
              const isActive = value <= draft.energy;
              return (
                <span
                  key={value}
                  className={`mood-energy-segment ${isActive ? "is-on" : ""}`}
                  style={{
                    ...(isActive ? getEnergySegmentStyle(ENERGY_COLORS[index]) : undefined),
                    "--seg-index": index,
                  }}
                />
              );
            })}
          </div>
        </div>
        <div className="mood-energy-labels">
          <span>Morto por dentro</span>
          <span>Modo foguete</span>
        </div>
      </div>

      <div className="mood-tags-block">
        <div className="mood-energy-head">
          <span>O que define seu dia até agora?</span>
          <strong className="mood-tag-counter" aria-live="polite">
            {draft.tags.length}/{MAX_MOOD_TAGS}
          </strong>
        </div>
        <div className={`mood-tag-list ${isAtTagCap ? "is-at-cap" : ""}`}>
          {MOOD_TAGS.map((tag) => {
            const isSelected = draft.tags.includes(tag);
            const isBlocked = isAtTagCap && !isSelected;
            return (
              <button
                key={tag}
                type="button"
                className={`mood-tag-chip ${isSelected ? "is-selected" : ""} ${isBlocked ? "is-blocked" : ""}`}
                disabled={disabled}
                aria-pressed={isSelected}
                aria-disabled={isBlocked || undefined}
                onClick={() => onToggleTag(tag)}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {submitError && <div className="mood-inline-error">{submitError}</div>}

      <div className="mood-actions">
        <button
          type="button"
          className="btn-primary mood-submit-button"
          onClick={onSubmit}
          disabled={!draft.moodId || isPending || disabled}
          aria-busy={isPending}
        >
          {isPending ? (
            <span className="mood-submit-pending">
              Registrando
              <span className="mood-submit-dots" aria-hidden="true">
                <i /><i /><i />
              </span>
            </span>
          ) : (
            "Registrar vibe"
          )}
        </button>
      </div>
    </div>
  );
}

export default MoodStepEnergy;
