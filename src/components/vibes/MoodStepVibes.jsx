import { Lock } from "lucide-react";
import { MOOD_OPTIONS } from "../../lib/dashboardMood";

const COLUMNS = 4;

/**
 * Passo 1: escolha da vibe.
 *
 * Entrada em ondas de linha (nao cascata por card): 8 cards com stagger
 * individual violariam a regra de 1/3 de elementos em movimento e passariam
 * do teto de 500ms. Duas ondas de 4 resolvem os dois.
 *
 * O preview do orbe dispara em hover E focus, entao teclado tem a mesma
 * experiencia do mouse sem nenhum codigo extra.
 */
export function MoodStepVibes({
  selectedMoodId = "",
  disabled = false,
  isCommitting = false,
  onSelect,
  onPreview,
}) {
  const selectedIndex = MOOD_OPTIONS.findIndex((mood) => mood.id === selectedMoodId);

  const handlePreview = (moodId) => {
    if (typeof onPreview === "function") onPreview(moodId);
  };

  return (
    <div className="mood-panel">
      <div className="mood-check-privacy mood-check-privacy--compact">
        <Lock size={15} />
        <span>100% anônimo. Ninguém vê quem registrou a vibe.</span>
      </div>

      <div
        className={`mood-grid ${isCommitting ? "is-committing" : ""}`}
        role="group"
        aria-label="Escolha sua vibe"
      >
        {MOOD_OPTIONS.map((mood, index) => {
          const isSelected = mood.id === selectedMoodId;
          const distance = selectedIndex >= 0 ? Math.abs(index - selectedIndex) : 0;

          return (
            <button
              key={mood.id}
              type="button"
              className={`mood-choice ${isSelected ? "is-selected" : ""}`}
              style={{
                "--mood-accent": mood.accent,
                "--mood-soft": mood.soft,
                "--row": Math.floor(index / COLUMNS),
                "--dist": distance,
              }}
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => onSelect(mood.id)}
              onMouseEnter={() => handlePreview(mood.id)}
              onMouseLeave={() => handlePreview("")}
              onFocus={() => handlePreview(mood.id)}
              onBlur={() => handlePreview("")}
            >
              <span className="mood-choice-emoji" aria-hidden="true">{mood.emoji}</span>
              <strong className="mood-choice-label">{mood.label}</strong>
              <span className="mood-choice-vibe">{mood.vibe}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MoodStepVibes;
