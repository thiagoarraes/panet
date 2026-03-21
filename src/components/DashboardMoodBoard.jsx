import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, RefreshCw } from "lucide-react";
import { useSaveMoodCheckin } from "../hooks/mutations/useMoodCheckinMutations";
import { useMoodCheckins } from "../hooks/queries/useMoodCheckins";
import {
  ENERGY_COLORS,
  MAX_MOOD_TAGS,
  MOOD_TIME_ZONE,
  MOOD_OPTIONS,
  MOOD_TAGS,
  getEnergyColor,
  getEnergyGlyph,
  getEnergyLabel,
  getMoodWindowState,
  getMoodOption,
  normalizeMoodTags,
} from "../lib/dashboardMood";

const TEAM_WALL_CARD_MIN_WIDTH = 150;
const TEAM_WALL_CARD_GAP = 10;

const buildDraftFromEntry = (entry) => ({
  moodId: entry?.moodId || "",
  energy: entry?.energy || 5,
  tags: normalizeMoodTags(entry?.tags).slice(0, MAX_MOOD_TAGS),
});

const getFirstName = (name) => String(name || "").trim().split(/\s+/).filter(Boolean)[0] || "time";

const formatTodayLabel = () =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: MOOD_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

const formatTimeLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { timeZone: MOOD_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
};

const getEnergySegmentStyle = (color) => ({
  background: `linear-gradient(180deg, color-mix(in srgb, ${color} 86%, #ffffff), ${color})`,
  borderColor: `color-mix(in srgb, ${color} 44%, transparent)`,
  boxShadow: `0 12px 22px color-mix(in srgb, ${color} 24%, transparent)`,
});

const getEnergyFillStyle = (width, color) => ({
  width,
  background: `linear-gradient(90deg, color-mix(in srgb, ${color} 76%, #ffffff), ${color})`,
});

const getMoodWindowMessage = (moodWindow) => {
  if (moodWindow.isAfterClose) {
    return "Os registros de vibe ficam abertos até 18:00. Novas vibes voltam amanhã às 08:00, no horário de Brasília.";
  }
  if (moodWindow.isResetGap) {
    return "As vibes do ciclo anterior foram encerradas. Novos registros abrem às 08:00, no horário de Brasília.";
  }
  return "Novas vibes ficam disponíveis às 08:00 e podem ser atualizadas até 18:00, no horário de Brasília.";
};

export function DashboardMoodBoard({ currentUser, currentUserId }) {
  const hydratedEntryRef = useRef("");
  const teamWallViewportRef = useRef(null);
  const teamWallGroupRef = useRef(null);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(() => buildDraftFromEntry(null));
  const [submitError, setSubmitError] = useState("");
  const [isTeamWallPaused, setIsTeamWallPaused] = useState(false);
  const [timeTick, setTimeTick] = useState(() => Date.now());
  const [teamWallViewportWidth, setTeamWallViewportWidth] = useState(0);
  const [teamWallLoopWidth, setTeamWallLoopWidth] = useState(0);
  const moodWindow = useMemo(() => getMoodWindowState(new Date(timeTick)), [timeTick]);
  const dateKey = moodWindow.dateKey;
  const moodWindowMessage = useMemo(() => getMoodWindowMessage(moodWindow), [moodWindow]);
  const moodCheckinsQuery = useMoodCheckins(currentUserId, { dateKey });
  const saveMoodCheckin = useSaveMoodCheckin(currentUserId, { dateKey });

  const entries = useMemo(
    () => (Array.isArray(moodCheckinsQuery.data) ? moodCheckinsQuery.data : []),
    [moodCheckinsQuery.data]
  );
  const myEntry = useMemo(
    () => entries.find((entry) => String(entry.colaboradorId) === String(currentUserId)) || null,
    [currentUserId, entries]
  );
  const currentUserFirstName = useMemo(() => getFirstName(currentUser?.nome), [currentUser?.nome]);
  const maxVisibleTeamWallCards = useMemo(() => {
    if (teamWallViewportWidth <= 0) return entries.length;
    return Math.max(
      1,
      Math.floor((teamWallViewportWidth + TEAM_WALL_CARD_GAP) / (TEAM_WALL_CARD_MIN_WIDTH + TEAM_WALL_CARD_GAP))
    );
  }, [entries.length, teamWallViewportWidth]);
  const shouldAutoScrollTeamWall = entries.length > maxVisibleTeamWallCards;
  const teamWallAnimationDuration = useMemo(() => `${Math.max(24, entries.length * 4)}s`, [entries.length]);
  const isMoodBoardLoading = moodCheckinsQuery.isLoading && entries.length === 0 && !moodCheckinsQuery.isError;
  const shouldShowTeamWall = step === 3 || (Boolean(myEntry) && step === 1) || (!moodWindow.canSubmit && entries.length > 0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimeTick(Date.now());
    }, 30 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!myEntry) return;

    const signature = `${myEntry.id}:${myEntry.updatedAt}`;
    if (hydratedEntryRef.current === signature) return;

    hydratedEntryRef.current = signature;
    setDraft(buildDraftFromEntry(myEntry));
    setStep(3);
  }, [myEntry]);

  useEffect(() => {
    hydratedEntryRef.current = "";
    setSubmitError("");
  }, [dateKey]);

  useEffect(() => {
    if (moodCheckinsQuery.isLoading || myEntry) return;
    setDraft(buildDraftFromEntry(null));
    setStep(1);
  }, [dateKey, moodCheckinsQuery.isLoading, myEntry]);

  useEffect(() => {
    const node = teamWallViewportRef.current;
    if (!node) return undefined;

    let frameId = 0;
    const measure = () => {
      frameId = window.requestAnimationFrame(() => {
        const nextWidth = node.clientWidth || 0;
        setTeamWallViewportWidth((current) => (current === nextWidth ? current : nextWidth));
      });
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => {
        window.cancelAnimationFrame(frameId);
        window.removeEventListener("resize", measure);
      };
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [entries.length, step]);

  useEffect(() => {
    if (shouldAutoScrollTeamWall) return;
    setIsTeamWallPaused(false);
  }, [shouldAutoScrollTeamWall]);

  useEffect(() => {
    if (!shouldAutoScrollTeamWall) {
      setTeamWallLoopWidth(0);
      return undefined;
    }

    const node = teamWallGroupRef.current;
    if (!node) return undefined;

    let frameId = 0;
    const measure = () => {
      frameId = window.requestAnimationFrame(() => {
        const nextWidth = node.scrollWidth || 0;
        setTeamWallLoopWidth((current) => (current === nextWidth ? current : nextWidth));
      });
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => {
        window.cancelAnimationFrame(frameId);
        window.removeEventListener("resize", measure);
      };
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [entries, shouldAutoScrollTeamWall]);

  const handlePauseTeamWall = () => {
    if (!shouldAutoScrollTeamWall) return;
    setIsTeamWallPaused(true);
  };

  const handleResumeTeamWall = () => {
    if (!shouldAutoScrollTeamWall) return;
    setIsTeamWallPaused(false);
  };

  const renderTeamWallCard = (entry, keyPrefix = "") => {
    const mood = getMoodOption(entry.moodId);
    const energyWidth = `${Math.max(10, entry.energy * 10)}%`;
    const energyColor = getEnergyColor(entry.energy);
    const cardKey = keyPrefix ? `${keyPrefix}${entry.id}` : entry.id;

    return (
      <article
        key={cardKey}
        className="mood-team-card mood-team-card--wall"
        style={{ "--energy-color": energyColor }}
        onMouseEnter={handlePauseTeamWall}
        onMouseLeave={handleResumeTeamWall}
        onTouchStart={handlePauseTeamWall}
        onTouchEnd={handleResumeTeamWall}
        onTouchCancel={handleResumeTeamWall}
      >
        <div className="mood-team-emoji-wrap">{mood.emoji}</div>
        <div className="mood-team-energy-bar">
          <span className="mood-team-energy-fill" style={getEnergyFillStyle(energyWidth, energyColor)} />
        </div>
        <div className="mood-team-energy-label">
          {getEnergyGlyph(entry.energy)} {getEnergyLabel(entry.energy)}
        </div>
        {entry.tags.length > 0 && (
          <div className="mood-mini-chips is-compact">
            {entry.tags.map((tag) => (
              <span key={tag} className="mood-mini-chip">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="mood-team-time mood-team-time--foot">{formatTimeLabel(entry.updatedAt || entry.createdAt)}</div>
      </article>
    );
  };

  const handleSelectMood = (moodId) => {
    if (!moodWindow.canSubmit) return;
    setDraft((previous) => ({ ...previous, moodId }));
    setSubmitError("");
    setStep(2);
  };

  const handleToggleTag = (tag) => {
    if (!moodWindow.canSubmit) return;
    setDraft((previous) => {
      const hasTag = previous.tags.includes(tag);
      if (hasTag) {
        return { ...previous, tags: previous.tags.filter((item) => item !== tag) };
      }
      if (previous.tags.length >= MAX_MOOD_TAGS) return previous;
      return { ...previous, tags: [...previous.tags, tag] };
    });
  };

  const handleEditVibe = () => {
    if (!moodWindow.canEdit) return;
    setSubmitError("");
    setDraft(buildDraftFromEntry(myEntry));
    setStep(myEntry?.moodId ? 2 : 1);
  };

  const handleSubmit = async () => {
    if (!draft.moodId || saveMoodCheckin.isPending || !moodWindow.canSubmit) return;

    try {
      setSubmitError("");
      await saveMoodCheckin.mutateAsync({
        colaboradorId: currentUserId,
        moodId: draft.moodId,
        energy: draft.energy,
        tags: draft.tags,
      });
      setStep(3);
    } catch (error) {
      setSubmitError(error?.message || "Não foi possível registrar sua vibe agora.");
    }
  };

  if (isMoodBoardLoading) {
    return (
      <section className="card mood-check-card">
        <div className="mood-check-shell is-single">
          <div className="mood-check-main mood-check-main--team">
            <div className="mood-loading-head" aria-hidden="true">
              <div className="mood-loading-line mood-loading-line--title" />
              <div className="mood-loading-line mood-loading-line--subtitle" />
            </div>
            <div className="mood-loading-grid" aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="mood-loading-card mood-loading-card--team" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card mood-check-card">
      <div className="mood-check-shell is-single">
        {!shouldShowTeamWall && (
          <div className="mood-check-main mood-check-main--flow">
            <div className="mood-check-hero mood-check-hero--compact">
              <div>
                <h2 className="mood-check-title">
                  Em que vibe você tá hoje, <span className="mood-check-title-accent">{currentUserFirstName}</span>?
                </h2>
                <p className="mood-check-subtitle">{formatTodayLabel()}</p>
              </div>
            </div>

            {moodWindow.canSubmit && (
              <div className="mood-stepper" aria-hidden="true">
                {[1, 2].map((value) => (
                  <span
                    key={value}
                    className={`mood-stepper-dot ${step === value ? "is-active" : ""} ${step > value ? "is-done" : ""}`}
                  />
                ))}
              </div>
            )}

            {!moodWindow.canSubmit && (
              <div className="mood-panel">
                <div className="mood-window-note">
                  <strong>Registro indisponível agora</strong>
                  <span>{moodWindowMessage}</span>
                </div>
              </div>
            )}

            {moodWindow.canSubmit && step === 1 && (
              <div className="mood-panel">
                <div className="mood-check-privacy mood-check-privacy--compact">
                  <Lock size={15} />
                  <span>100% anônimo. Ninguém vê quem registrou a vibe.</span>
                </div>

                <div className="mood-grid">
                  {MOOD_OPTIONS.map((mood) => (
                    <button
                      key={mood.id}
                      type="button"
                      className="mood-choice"
                      style={{ "--mood-accent": mood.accent, "--mood-soft": mood.soft }}
                      disabled={!moodWindow.canSubmit}
                      onClick={() => handleSelectMood(mood.id)}
                    >
                      <span className="mood-choice-emoji">{mood.emoji}</span>
                      <strong className="mood-choice-label">{mood.label}</strong>
                      <span className="mood-choice-vibe">{mood.vibe}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {moodWindow.canSubmit && step === 2 && (
              <div className="mood-panel">
                <div className="mood-panel-head">
                  <div>
                    <div className="mood-panel-eyebrow">Nível de energia</div>
                    <h3>
                      {getEnergyGlyph(draft.energy)} {getEnergyLabel(draft.energy)}
                    </h3>
                  </div>
                  <button type="button" className="btn-ghost mood-inline-button" onClick={() => setStep(1)}>
                    Voltar
                  </button>
                </div>

                <div className="mood-energy-block">
                  <div className="mood-energy-track" role="list" aria-label="Nível de energia">
                    {Array.from({ length: 10 }, (_, index) => {
                      const value = index + 1;
                      const isActive = value <= draft.energy;
                      return (
                        <button
                          key={value}
                          type="button"
                          className={`mood-energy-segment ${isActive ? "is-on" : ""}`}
                          style={isActive ? getEnergySegmentStyle(ENERGY_COLORS[index]) : undefined}
                          disabled={!moodWindow.canSubmit}
                          onClick={() => setDraft((previous) => ({ ...previous, energy: value }))}
                          aria-label={`Energia ${value}`}
                        />
                      );
                    })}
                  </div>
                  <div className="mood-energy-labels">
                    <span>Morto por dentro</span>
                    <span>Modo foguete</span>
                  </div>
                </div>

                <div className="mood-tags-block">
                  <div className="mood-energy-head">
                    <span>O que define seu dia até agora?</span>
                    <strong>{draft.tags.length}/{MAX_MOOD_TAGS}</strong>
                  </div>
                  <div className="mood-tag-list">
                    {MOOD_TAGS.map((tag) => {
                      const isSelected = draft.tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`mood-tag-chip ${isSelected ? "is-selected" : ""}`}
                          disabled={!moodWindow.canSubmit}
                          onClick={() => handleToggleTag(tag)}
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
                    onClick={handleSubmit}
                    disabled={!draft.moodId || saveMoodCheckin.isPending || !moodWindow.canSubmit}
                  >
                    {saveMoodCheckin.isPending ? "Registrando..." : "Registrar vibe"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {shouldShowTeamWall && (
          <div className="mood-check-main mood-check-main--team">
            <div className="mood-team-wall-head">
              <div className="mood-team-wall-copy">
                <h3 className="section-title mood-team-wall-title">Painel de vibes</h3>
                <p className="section-sub mood-team-wall-subtitle">Vibes registradas no ciclo atual do time</p>
              </div>
              <button
                type="button"
                className="btn-ghost mood-inline-button"
                onClick={handleEditVibe}
                disabled={!moodWindow.canEdit}
                title={!moodWindow.canEdit ? moodWindowMessage : undefined}
              >
                <RefreshCw size={14} />
                Atualizar minha vibe
              </button>
            </div>

            {!moodWindow.canSubmit && (
              <div className="mood-window-note mood-window-note--team">
                <strong>Registro indisponível agora</strong>
                <span>{moodWindowMessage}</span>
              </div>
            )}

            {moodCheckinsQuery.isLoading && entries.length === 0 && (
              <div className="mood-loading-grid" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="mood-loading-card mood-loading-card--team" />
                ))}
              </div>
            )}

            {moodCheckinsQuery.isError && (
              <div className="mood-empty-state">
                Não foi possível carregar as vibes do time agora. Tente novamente em instantes.
              </div>
            )}

            {!moodCheckinsQuery.isError && entries.length > 0 && (
              <div ref={teamWallViewportRef}>
                {shouldAutoScrollTeamWall ? (
                  <div
                    className={`mood-team-carousel ${teamWallLoopWidth > 0 ? "is-ready" : ""} ${isTeamWallPaused ? "is-paused" : ""}`}
                    style={{
                      "--mood-wall-duration": teamWallAnimationDuration,
                      "--mood-wall-loop-width": `${teamWallLoopWidth}px`,
                    }}
                  >
                    <div className="mood-team-carousel-track">
                      <div ref={teamWallGroupRef} className="mood-team-carousel-group">
                        {entries.map((entry) => renderTeamWallCard(entry))}
                      </div>
                      <div className="mood-team-carousel-group" aria-hidden="true">
                        {entries.map((entry) => renderTeamWallCard(entry, "clone-"))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mood-team-grid mood-team-grid--wall">
                    {entries.map((entry) => renderTeamWallCard(entry))}
                  </div>
                )}
              </div>
            )}

            {!moodCheckinsQuery.isError && entries.length === 0 && !moodCheckinsQuery.isLoading && (
              <div className="mood-empty-state">
                Ainda não houve check-ins hoje. O primeiro registro aparece aqui assim que alguém enviar a própria vibe.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
