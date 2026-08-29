import { ENERGY_COLORS, getMoodCelebration, getMoodOption } from "../../lib/dashboardMood";

const CONFETTI_COUNT = 24;

/**
 * Recompensa de registro: onda de choque + confete + frase.
 *
 * Cabe no orcamento de 2600ms que o container ja segura no timeout.
 * O confete arca de lado (--confetti-drift) em vez de cair reto: movimento
 * espacial linear e a leitura mais robotica possivel, e alegria pede arcos.
 */
export function MoodCelebration({ moodId }) {
  const mood = getMoodOption(moodId);

  return (
    <div className="mood-celebration" aria-hidden="true">
      <span className="vibe-shockwave" style={{ "--mood-accent": mood.accent }} />
      {Array.from({ length: CONFETTI_COUNT }, (_, index) => (
        <span
          key={index}
          className="mood-confetti"
          style={{
            "--confetti-x": `${(index * 41) % 100}%`,
            "--confetti-delay": `${(index % 8) * 0.045}s`,
            "--confetti-drift": `${((index % 5) - 2) * 14}px`,
            "--confetti-spin": `${((index % 3) + 1) * 240}deg`,
            "--confetti-color": ENERGY_COLORS[index % ENERGY_COLORS.length],
          }}
        />
      ))}
      <div className="mood-celebration-phrase" style={{ "--mood-accent": mood.accent }}>
        {getMoodCelebration(moodId)}
      </div>
    </div>
  );
}

export default MoodCelebration;
