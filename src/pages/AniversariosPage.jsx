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

export function AniversariosPage({ aniversariantes = [] }) {
  const mesAtualIndex = new Date().getMonth();
  const [mesSelecionado, setMesSelecionado] = useState(String(mesAtualIndex));

  const aniversariantesMesAtual = useMemo(
    () => aniversariantes.filter((a) => getMesIndex(a) === mesAtualIndex).sort(sortByDia),
    [aniversariantes, mesAtualIndex]
  );

  const opcoesMes = useMemo(
    () => MESES.map((nome, index) => ({ nome, index, total: aniversariantes.filter((a) => getMesIndex(a) === index).length })),
    [aniversariantes]
  );

  const aniversariantesMesSelecionado = useMemo(
    () => aniversariantes.filter((a) => getMesIndex(a) === Number(mesSelecionado)).sort(sortByDia),
    [aniversariantes, mesSelecionado]
  );

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
          <div className="card-header" style={{ alignItems: "center", gap: 12 }}>
            <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CalendarDays size={14} /> Todos os aniversariantes
            </span>
            <select
              className="search-input"
              style={{ marginLeft: "auto", minWidth: 170 }}
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
            >
              {opcoesMes.map((mes) => (
                <option key={mes.index} value={String(mes.index)}>
                  {mes.nome} ({mes.total})
                </option>
              ))}
            </select>
          </div>
          <div className="card-body" style={{ padding: "8px 16px" }}>
            {aniversariantesMesSelecionado.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>
                Nenhum aniversariante em {MESES[Number(mesSelecionado)]}
              </div>
            ) : (
              aniversariantesMesSelecionado.map((a) => <AnivCard key={a.id} a={a} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
