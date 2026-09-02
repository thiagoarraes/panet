import { useMemo, useState, useEffect } from "react";
import { useDashboardSnapshot } from "./useDashboardSnapshot";
import { usePostagens } from "./usePostagens";
import { useFerias } from "./useFerias";
import { useAusencias } from "./useAusencias";
import { useAniversarios } from "./useAniversarios";
import { useColaboradores } from "./useColaboradores";
import { useEnqueteAtiva } from "./useEnqueteAtiva";
import { isSupabaseEnabled } from "../../lib/supabase.js";
import { DASHBOARD_SNAPSHOT_INITIAL_LIMITS, DASHBOARD_SNAPSHOT_FULL_LIMITS } from "../../lib/dashboardLimits.js";
import { getAusenciaEffectiveEnd } from "../../lib/ausencias.js";
import { getFeriasStatusByDate, parseBrDate } from "../../lib/panoff.js";

const scheduleIdleTask = (callback, timeoutMs = 1800) => {
  if (typeof window === "undefined") return () => {};
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: timeoutMs });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, timeoutMs);
  return () => window.clearTimeout(id);
};

const daysUntilBirthday = (isoDate) => {
  const now = new Date();
  const target = new Date(`${isoDate}T12:00:00`);
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const thisYearTarget = new Date(now.getFullYear(), target.getMonth(), target.getDate(), 12, 0, 0);
  const next = thisYearTarget < todayNoon ? new Date(now.getFullYear() + 1, target.getMonth(), target.getDate(), 12, 0, 0) : thisYearTarget;
  const diffMs = next.getTime() - todayNoon.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
};

export function useDashboardData(currentUserId) {
  const [fullSnapshotEnabled, setFullSnapshotEnabled] = useState(false);
  const [moodBoardReady, setMoodBoardReady] = useState(false);
  
  const dashboardInitialSnapshotQuery = useDashboardSnapshot(currentUserId, DASHBOARD_SNAPSHOT_INITIAL_LIMITS);
  const hasInitialSnapshotData = Boolean(dashboardInitialSnapshotQuery.data);
  const shouldLoadFullSnapshot = fullSnapshotEnabled && hasInitialSnapshotData && !dashboardInitialSnapshotQuery.isError;
  
  const dashboardFullSnapshotQuery = useDashboardSnapshot(currentUserId, {
    ...DASHBOARD_SNAPSHOT_FULL_LIMITS,
    enabled: shouldLoadFullSnapshot,
  });
  
  const dashboardSnapshotData = dashboardFullSnapshotQuery.data || dashboardInitialSnapshotQuery.data || null;
  const hasSnapshotData = Boolean(dashboardSnapshotData);
  const snapshotIsLoading = !hasSnapshotData && dashboardInitialSnapshotQuery.isLoading;
  const useLegacyQueries = !isSupabaseEnabled || dashboardInitialSnapshotQuery.isError;

  useEffect(() => {
    if (!hasInitialSnapshotData || dashboardInitialSnapshotQuery.isError) {
      const id = setTimeout(() => setFullSnapshotEnabled(false), 0);
      return () => clearTimeout(id);
    }
  }, [hasInitialSnapshotData, dashboardInitialSnapshotQuery.isError]);

  useEffect(() => {
    if (!hasInitialSnapshotData || dashboardInitialSnapshotQuery.isError) return;
    const cancel = scheduleIdleTask(() => {
      setFullSnapshotEnabled(true);
    }, 1800);
    return cancel;
  }, [hasInitialSnapshotData, dashboardInitialSnapshotQuery.isError, currentUserId]);

  useEffect(() => {
    const id = setTimeout(() => setMoodBoardReady(false), 0);
    return () => clearTimeout(id);
  }, [currentUserId]);

  useEffect(() => {
    const cancel = scheduleIdleTask(() => {
      setMoodBoardReady(true);
    }, 350);
    return cancel;
  }, [currentUserId]);

  const postagensQuery = usePostagens(currentUserId, { limit: 20, enabled: useLegacyQueries });
  const feriasQuery = useFerias(currentUserId, { summaryOnly: true, enabled: useLegacyQueries });
  const ausenciasQuery = useAusencias(currentUserId, { summaryOnly: true, enabled: useLegacyQueries });
  const aniversariosQuery = useAniversarios(currentUserId, { enabled: useLegacyQueries });
  const colaboradoresQuery = useColaboradores(currentUserId, { summaryOnly: true, enabled: useLegacyQueries });
  const enqueteQuery = useEnqueteAtiva(currentUserId, { enabled: Boolean(currentUserId) });

  const postagens = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotData?.postagens || [] : postagensQuery.data || []),
    [hasSnapshotData, dashboardSnapshotData, postagensQuery.data]
  );
  
  const feriasData = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotData?.feriasData || null : feriasQuery.data || null),
    [hasSnapshotData, dashboardSnapshotData, feriasQuery.data]
  );
  const ferias = useMemo(() => feriasData?.ferias || [], [feriasData]);
  const dayoff = useMemo(() => feriasData?.dayoff || [], [feriasData]);
  
  const ausencias = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotData?.ausencias || [] : ausenciasQuery.data || []),
    [hasSnapshotData, dashboardSnapshotData, ausenciasQuery.data]
  );
  
  const aniversariantes = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotData?.aniversariantes || [] : aniversariosQuery.data || []),
    [hasSnapshotData, dashboardSnapshotData, aniversariosQuery.data]
  );
  
  const colaboradores = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotData?.colaboradores || [] : colaboradoresQuery.data || []),
    [hasSnapshotData, dashboardSnapshotData, colaboradoresQuery.data]
  );

  const dashboardIssues = useLegacyQueries
    ? [
        { label: "PanNews", error: postagensQuery.error },
        { label: "PanOff", error: feriasQuery.error || ausenciasQuery.error },
        { label: "Aniversários", error: aniversariosQuery.error },
        { label: "Colaboradores", error: colaboradoresQuery.error },
      ].filter((item) => Boolean(item.error))
    : [];

  const aniversariantesTodos = useMemo(() => {
    const byId = new Map(aniversariantes.map((item) => [String(item?.colaborador?.id || item?.id), item]));
    const fromColaboradores = colaboradores
      .filter((col) => Boolean(col?.aniversario))
      .map((col) => {
        const existing = byId.get(String(col.id));
        if (existing) return existing;
        const date = new Date(`${col.aniversario}T12:00:00`);
        return {
          id: col.id,
          colaborador: col,
          data: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          diasRestantes: daysUntilBirthday(col.aniversario),
          reacoes: [],
        };
      });

    return fromColaboradores.sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [aniversariantes, colaboradores]);

  const today = aniversariantesTodos.find((a) => a.diasRestantes === 0);
  const proximos = aniversariantesTodos
    .filter((a) => a.diasRestantes >= 0)
    .sort((a, b) => a.diasRestantes - b.diasRestantes)
    .slice(0, 5);

  const parabenizadores = useMemo(() => {
    if (!today?.reacoes?.length) return [];
    const byId = new Map(colaboradores.map((c) => [String(c.id), c]));
    return today.reacoes.map((id) => byId.get(String(id))).filter(Boolean);
  }, [colaboradores, today]);

  const userJaParabenizou = Boolean(today?.reacoes?.includes(currentUserId));

  const ausentesAgora = useMemo(() => {
    const now = new Date();
    return ausencias
      .filter((a) => {
        if (!a.inicio) return false;
        const fim = getAusenciaEffectiveEnd(a);
        return !fim || fim >= now;
      })
      .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  }, [ausencias]);

  const proximasFolgas = useMemo(() => {
    const hoje = new Date();
    const hojeNoon = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12, 0, 0);
    const toSortable = (item, tipo) => {
      const inicioDate = parseBrDate(item.inicio);
      const fimDate = parseBrDate(item.fim || item.inicio);
      if (!inicioDate || !fimDate) return null;
      if (fimDate < hojeNoon) return null;
      const anchorDate = inicioDate < hojeNoon ? hojeNoon : inicioDate;
      return {
        ...item,
        tipo,
        _anchorDate: anchorDate,
        _effectiveStatus: tipo === "ferias" ? getFeriasStatusByDate(item) : item.status,
      };
    };
    const todos = [
      ...ferias.map((f) => toSortable(f, "ferias")),
      ...dayoff.map((d) => toSortable(d, "dayoff")),
    ]
      .filter(Boolean)
      .sort((a, b) => a._anchorDate.getTime() - b._anchorDate.getTime())
      .slice(0, 5);
    return todos;
  }, [dayoff, ferias]);

  return {
    snapshotIsLoading,
    moodBoardReady,
    postagens,
    feriasData,
    ausencias,
    aniversariantes,
    colaboradores,
    dashboardIssues,
    today,
    proximos,
    parabenizadores,
    userJaParabenizou,
    ausentesAgora,
    proximasFolgas,
    enqueteQuery,
    useLegacyQueries,
    postagensLoading: postagensQuery.isLoading,
    aniversariosLoading: aniversariosQuery.isLoading,
    feriasLoading: feriasQuery.isLoading,
    ausenciasLoading: ausenciasQuery.isLoading,
  };
}
