import { useMemo, useState } from "react";
import { Cake, CalendarDays } from "lucide-react";
import { Avatar } from "../components/Avatar";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const formatDiasRestantes = (diasRestantes) => {
  if (diasRestantes === 0) return "Hoje";
  if (diasRestantes === 1) return "Amanhã";
  return `em ${diasRestantes} dias`;
};

const formatBirthday = (isoDate) => {
  const [year, month, day] = String(isoDate || "").split("-");
  if (!year || !month || !day) return "";
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}`;
};

const daysUntilBirthday = (isoDate) => {
  const raw = String(isoDate || "");
  if (!raw) return 0;
  const [year, month, day] = raw.split("-").map((part) => Number(part));
  if (!year || !month || !day) return 0;

  const now = new Date();
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const thisYearTarget = new Date(now.getFullYear(), month - 1, day, 12, 0, 0);
  const nextTarget =
    thisYearTarget < todayNoon ? new Date(now.getFullYear() + 1, month - 1, day, 12, 0, 0) : thisYearTarget;
  const diffMs = nextTarget.getTime() - todayNoon.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
};

const getMesIndex = (item) => {
  const mes = Number(String(item?.data || "").split("/")[1] || 0);
  return Number.isFinite(mes) && mes >= 1 && mes <= 12 ? mes - 1 : -1;
};

const getDia = (item) => Number(String(item?.data || "").split("/")[0] || 0);

const sortByDia = (a, b) => {
  const diff = getDia(a) - getDia(b);
  if (diff !== 0) return diff;
  return String(a?.colaborador?.nome || "").localeCompare(String(b?.colaborador?.nome || ""), "pt-BR");
};

const sortByMesDia = (a, b) => {
  const mesDiff = getMesIndex(a) - getMesIndex(b);
  if (mesDiff !== 0) return mesDiff;
  return sortByDia(a, b);
};

export function AniversariosPage({ aniversariantes = [], colaboradores = [] }) {
  const mesAtualIndex = new Date().getMonth();
  const [mesSelecionado, setMesSelecionado] = useState("todos");

  const aniversariantesTodos = useMemo(() => {
    const aniversariantesById = new Map(aniversariantes.map((item) => [String(item?.colaborador?.id || item?.id), item]));

    const base = (colaboradores || [])
      .filter((col) => Boolean(col?.aniversario))
      .map((col) => {
        const existing = aniversariantesById.get(String(col.id));
        if (existing) {
          return {
            ...existing,
            colaborador: { ...col, ...(existing.colaborador || {}) },
          };
        }
        return {
          id: col.id,
          colaborador: col,
          data: formatBirthday(col.aniversario),
          diasRestantes: daysUntilBirthday(col.aniversario),
          reacoes: [],
        };
      });

    return base.filter((item) => item?.data).sort(sortByMesDia);
  }, [aniversariantes, colaboradores]);

  const aniversariantesMesAtual = useMemo(
    () => aniversariantesTodos.filter((a) => getMesIndex(a) === mesAtualIndex).sort(sortByDia),
    [aniversariantesTodos, mesAtualIndex]
  );

  const opcoesMes = useMemo(
    () =>
      MESES.map((nome, index) => ({
        nome,
        index,
        total: aniversariantesTodos.filter((a) => getMesIndex(a) === index).length,
      })),
    [aniversariantesTodos]
  );

  const aniversariantesFiltrados = useMemo(() => {
    if (mesSelecionado === "todos") return aniversariantesTodos;
    const mesIndex = Number(mesSelecionado);
    return aniversariantesTodos.filter((a) => getMesIndex(a) === mesIndex).sort(sortByDia);
  }, [aniversariantesTodos, mesSelecionado]);

  const AnivCard = ({ a }) => (
    <div className="aniv-item">
      <div className="aniv-date">
        {a.diasRestantes === 0 ? (
          <div style={{ display: "inline-flex" }}>
            <Cake size={20} color="var(--accent)" />
          </div>
        ) : (
          <>
            <div className="aniv-day">{a.data.split("/")[0]}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>/ {a.data.split("/")[1]}</div>
          </>
        )}
      </div>
      <Avatar col={a.colaborador} size={40} />
      <div className="aniv-info">
        <div className="aniv-name">{a.colaborador.nome}</div>
        <div className="aniv-cargo">
          {a.diasRestantes === 0 ? (
            <span className="today-badge">HOJE</span>
          ) : (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{formatDiasRestantes(a.diasRestantes)}</span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fade-up">
      <div className="section-title" style={{ marginBottom: 20, display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Cake size={22} /> Aniversários
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CalendarDays size={14} /> Aniversariantes do mês
            </span>
          </div>
          <div className="card-body" style={{ padding: "8px 16px" }}>
            {aniversariantesMesAtual.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>
                Nenhum aniversariante neste mês
              </div>
            ) : (
              aniversariantesMesAtual.map((a) => <AnivCard key={a.id} a={a} />)
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header aniv-all-header">
            <span className="card-title aniv-all-title">
              <CalendarDays size={14} /> Todos os aniversariantes ({aniversariantesFiltrados.length})
            </span>
            <select
              className="search-input aniv-all-select"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
            >
              <option value="todos">Todos ({aniversariantesTodos.length})</option>
              {opcoesMes.map((mes) => (
                <option key={mes.index} value={String(mes.index)}>
                  {mes.nome} ({mes.total})
                </option>
              ))}
            </select>
          </div>
          <div className="card-body" style={{ padding: "8px 16px", maxHeight: 420, overflowY: "auto" }}>
            {aniversariantesFiltrados.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>
                {mesSelecionado === "todos"
                  ? "Nenhum aniversariante cadastrado no perfil."
                  : `Nenhum aniversariante em ${MESES[Number(mesSelecionado)]}.`}
              </div>
            ) : (
              aniversariantesFiltrados.map((a) => <AnivCard key={a.id} a={a} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

