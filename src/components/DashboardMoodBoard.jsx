import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, RefreshCw } from "lucide-react";
import { useSaveMoodCheckin } from "../hooks/mutations/useMoodCheckinMutations";
import { useToggleMoodReaction } from "../hooks/mutations/useMoodReactionMutations";
import { useMoodCheckins } from "../hooks/queries/useMoodCheckins";
import { useMoodReactions } from "../hooks/queries/useMoodReactions";
import { isSupabaseEnabled } from "../lib/supabase";
import {
  ENERGY_COLORS,
  MAX_MOOD_TAGS,
  MOOD_TIME_ZONE,
  MOOD_OPTIONS,
  MOOD_REACTIONS,
  MOOD_TAGS,
  getAverageEnergy,
  getDominantMood,
  getEnergyColor,
  getEnergyGlyph,
  getEnergyLabel,
  getMoodCelebration,
  getMoodWindowState,
  getMoodOption,
  normalizeMoodTags,
} from "../lib/dashboardMood";
import { PanTooltip } from "./ui/PanTooltip";

const TEAM_WALL_CARD_MIN_WIDTH = 172;
const TEAM_WALL_CARD_GAP = 10;
const TEAM_WALL_MIN_CARDS_TO_SCROLL = 5;

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
  const teamWallGroupRef = useRef(null);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(() => buildDraftFromEntry(null));
  const [submitError, setSubmitError] = useState("");
  const [timeTick, setTimeTick] = useState(() => Date.now());
  const [teamWallLoopWidth, setTeamWallLoopWidth] = useState(0);
  const moodWindow = useMemo(() => getMoodWindowState(new Date(timeTick)), [timeTick]);
  const dateKey = moodWindow.dateKey;
  const moodWindowMessage = useMemo(() => getMoodWindowMessage(moodWindow), [moodWindow]);
  const moodCheckinsQuery = useMoodCheckins(currentUserId, { dateKey });
  const saveMoodCheckin = useSaveMoodCheckin(currentUserId, { dateKey });
  const moodReactionsQuery = useMoodReactions(currentUserId, { dateKey });
  const toggleMoodReaction = useToggleMoodReaction(currentUserId, { dateKey });
  const [celebration, setCelebration] = useState(null);
  const celebrationTimeoutRef = useRef(0);

  const entries = useMemo(
    () => (Array.isArray(moodCheckinsQuery.data) ? moodCheckinsQuery.data : []),
    [moodCheckinsQuery.data]
  );
  const myEntry = useMemo(
    () => entries.find((entry) => String(entry.colaboradorId) === String(currentUserId)) || null,
    [currentUserId, entries]
  );
  const reactionsByCheckin = useMemo(() => {
    const grouped = new Map();
    const reactions = Array.isArray(moodReactionsQuery.data) ? moodReactionsQuery.data : [];
    for (const reaction of reactions) {
      if (!reaction?.checkinId || !reaction?.emoji) continue;
      const key = String(reaction.checkinId);
      const bucket = grouped.get(key) || {};
      const slot = bucket[reaction.emoji] || { count: 0, mine: false, myReactionId: null };
      slot.count += 1;
      if (String(reaction.colaboradorId) === String(currentUserId)) {
        slot.mine = true;
        slot.myReactionId = reaction.id;
      }
      bucket[reaction.emoji] = slot;
      grouped.set(key, bucket);
    }
    return grouped;
  }, [currentUserId, moodReactionsQuery.data]);
  const dominantMood = useMemo(() => getDominantMood(entries), [entries]);
  const averageEnergy = useMemo(() => getAverageEnergy(entries), [entries]);
  const sameVibeCount = useMemo(
    () =>
      myEntry
        ? entries.filter(
            (entry) =>
              entry.moodId === myEntry.moodId && String(entry.colaboradorId) !== String(myEntry.colaboradorId)
          ).length
        : 0,
    [entries, myEntry]
  );
  const currentUserFirstName = useMemo(() => getFirstName(currentUser?.nome), [currentUser?.nome]);
  const shouldAutoScrollTeamWall = entries.length >= TEAM_WALL_MIN_CARDS_TO_SCROLL;
  const estimatedLoopWidth = useMemo(
    () => Math.max(0, entries.length * (TEAM_WALL_CARD_MIN_WIDTH + TEAM_WALL_CARD_GAP) - TEAM_WALL_CARD_GAP),
    [entries.length]
  );
  const effectiveTeamWallLoopWidth = teamWallLoopWidth > 0 ? teamWallLoopWidth : estimatedLoopWidth;
  const teamWallAnimationDuration = useMemo(() => `${Math.max(18, entries.length * 3.2)}s`, [entries.length]);
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
    const id = setTimeout(() => setSubmitError(""), 0);
    return () => clearTimeout(id);
  }, [dateKey]);

  useEffect(() => {
    if (moodCheckinsQuery.isLoading || myEntry) return;
    const id = setTimeout(() => {
      setDraft(buildDraftFromEntry(null));
      setStep(1);
    }, 0);
    return () => clearTimeout(id);
  }, [dateKey, moodCheckinsQuery.isLoading, myEntry]);

  useEffect(() => {
    if (!shouldAutoScrollTeamWall) {
      const id = setTimeout(() => setTeamWallLoopWidth(0), 0);
      return () => clearTimeout(id);
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

  useEffect(() => {
    return () => {
      window.clearTimeout(celebrationTimeoutRef.current);
    };
  }, []);

  const handleToggleReaction = (entry, reactionId) => {
    if (toggleMoodReaction.isPending) return;
    const bucket = reactionsByCheckin.get(String(entry.id)) || {};
    const slot = bucket[reactionId];
    toggleMoodReaction.mutate({
      checkinId: entry.id,
      emoji: reactionId,
      existingReactionId: slot?.mine ? slot.myReactionId : null,
    });
  };

  const renderReactionRow = (entry) => {
    const isMyCard = String(entry.colaboradorId) === String(currentUserId);
    const isPendingEntry = Boolean(entry.pending) || String(entry.id).startsWith("optimistic-");
    if (!isSupabaseEnabled || isMyCard || isPendingEntry) return null;

    const bucket = reactionsByCheckin.get(String(entry.id)) || {};

    return (
      <div className="mood-reaction-row">
        {MOOD_REACTIONS.map((reaction) => {
          const slot = bucket[reaction.id];
          const count = slot?.count || 0;
          return (
            <button
              key={reaction.id}
              type="button"
              className={`mood-reaction-btn ${slot?.mine ? "is-mine" : ""} ${count > 0 ? "has-count" : ""}`}
              onClick={() => handleToggleReaction(entry, reaction.id)}
              aria-label={`Reagir com ${reaction.emoji}`}
              aria-pressed={Boolean(slot?.mine)}
            >
              <span aria-hidden="true">{reaction.emoji}</span>
              {count > 0 && <span className="mood-reaction-count">{count}</span>}
            </button>
          );
        })}
      </div>
    );
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
        style={{ "--energy-color": energyColor, "--mood-accent": mood.accent }}
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
        {renderReactionRow(entry)}
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
      setCelebration({ moodId: draft.moodId });
      window.clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = window.setTimeout(() => setCelebration(null), 2600);
      setStep(3);
    } catch (error) {
      setSubmitError(error?.message || "Não foi possível registrar sua vibe agora.");
    }
  };

  if (isMoodBoardLoading) {
    return (
      <section className="pan-card mood-check-card">
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
    <section className="pan-card mood-check-card">
      {celebration && (
        <div className="mood-celebration" aria-hidden="true">
          {Array.from({ length: 24 }, (_, index) => (
            <span
              key={index}
              className="mood-confetti"
              style={{
                "--confetti-x": `${(index * 41) % 100}%`,
                "--confetti-delay": `${(index % 8) * 0.09}s`,
                "--confetti-color": ENERGY_COLORS[index % ENERGY_COLORS.length],
              }}
            />
          ))}
          <div
            className="mood-celebration-phrase"
            style={{ "--mood-accent": getMoodOption(celebration.moodId).accent }}
          >
            {getMoodCelebration(celebration.moodId)}
          </div>
        </div>
      )}
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
              <PanTooltip texto={moodWindow.canEdit ? undefined : moodWindowMessage}>
                <button
                  type="button"
                  className="btn-ghost mood-inline-button"
                  onClick={handleEditVibe}
                  disabled={!moodWindow.canEdit}
                >
                  <RefreshCw size={14} />
                  Atualizar minha vibe
                </button>
              </PanTooltip>
            </div>

            {!moodWindow.canSubmit && (
              <div className="mood-window-note mood-window-note--team">
                <strong>Registro indisponível agora</strong>
                <span>{moodWindowMessage}</span>
              </div>
            )}

            {entries.length >= 2 && dominantMood && (
              <div className="mood-vibe-stats">
                <div
                  className="mood-vibe-stat"
                  style={{ "--mood-accent": getMoodOption(dominantMood.moodId).accent }}
                >
                  <span className="mood-vibe-stat-emoji">{getMoodOption(dominantMood.moodId).emoji}</span>
                  <div className="mood-vibe-stat-copy">
                    <strong>Vibe do dia</strong>
                    <span>
                      {getMoodOption(dominantMood.moodId).label} · {dominantMood.count}{" "}
                      {dominantMood.count === 1 ? "pessoa" : "pessoas"}
                    </span>
                  </div>
                </div>
                <div className="mood-vibe-stat">
                  <div className="mood-vibe-stat-copy">
                    <strong>Energia média</strong>
                    <span>
                      {getEnergyGlyph(averageEnergy)} {averageEnergy}/10
                    </span>
                  </div>
                  <div className="mood-vibe-meter">
                    <span
                      style={{
                        width: `${Math.min(100, Math.max(6, averageEnergy * 10))}%`,
                        background: getEnergyColor(averageEnergy),
                      }}
                    />
                  </div>
                </div>
                {sameVibeCount > 0 && (
                  <div className="mood-vibe-stat is-match">
                    <div className="mood-vibe-stat-copy">
                      <strong>Match de vibe</strong>
                      <span>+{sameVibeCount} na mesma vibe que você ✨</span>
                    </div>
                  </div>
                )}
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
              <div>
                {shouldAutoScrollTeamWall ? (
                  <div
                    className={`mood-team-carousel ${effectiveTeamWallLoopWidth > 0 ? "is-ready" : ""}`}
                    style={{
                      "--mood-wall-duration": teamWallAnimationDuration,
                      "--mood-wall-loop-width": `${effectiveTeamWallLoopWidth}px`,
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
