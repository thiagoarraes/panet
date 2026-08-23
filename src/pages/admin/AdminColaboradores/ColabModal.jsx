import { Button, Modal } from "@heroui/react";
import { MODULES, MONTH_OPTIONS } from "../../../lib/adminColabUtils.js";

export function ColabModal({ modal, form, setForm, errorMsg, loading, isSuperAdmin, onClose, onSalvar }) {
  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
    >
      <Modal.Container scroll="inside">
        <Modal.Dialog style={{ maxWidth: 640, border: "1px solid var(--border)" }}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
              {modal === "novo" ? "Novo colaborador" : "Editar colaborador"}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
          {errorMsg && (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,107,107,0.4)",
                background: "rgba(255,107,107,0.1)",
                color: "var(--danger)",
                fontSize: 13,
              }}
            >
              {errorMsg}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">NOME COMPLETO *</label>
            <input
              className="form-input"
              value={form.nome || ""}
              onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Ana Paula Ferreira"
            />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">E-MAIL CORPORATIVO *</label>
              <input
                className="form-input"
                value={form.email || ""}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="nome@agenciapan.com"
              />
            </div>
            <div className="form-group">
              <label className="form-label">PERFIL</label>
              <select
                className="form-input"
                value={form.perfil || "colaborador"}
                onChange={(e) => setForm((p) => ({ ...p, perfil: e.target.value }))}
              >
                <option value="colaborador">Colaborador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">CARGO *</label>
              <input
                className="form-input"
                value={form.cargo || ""}
                onChange={(e) => setForm((p) => ({ ...p, cargo: e.target.value }))}
                placeholder="Ex: Designer, Redator, Desenvolvedor"
              />
            </div>
            <div className="form-group">
              <label className="form-label">ANIVERSÁRIO (DIA E MÊS)</label>
              <div className="grid-2 perfil-aniversario-grid">
                <select
                  className="form-input"
                  value={form.aniversarioDia || ""}
                  onChange={(e) => setForm((p) => ({ ...p, aniversarioDia: e.target.value }))}
                >
                  <option value="">Dia</option>
                  {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select
                  className="form-input"
                  value={form.aniversarioMes || ""}
                  onChange={(e) => setForm((p) => ({ ...p, aniversarioMes: e.target.value }))}
                >
                  <option value="">Mês</option>
                  {MONTH_OPTIONS.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                Essa data alimenta a página de aniversários da Panet.
              </div>
            </div>
          </div>

          {modal === "novo" && (
            <div className="form-group">
              <label className="form-label">SENHA TEMPORÁRIA</label>
              <input className="form-input" type="text" value="Gerada automaticamente ao cadastrar" readOnly />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                O colaborador será obrigado a trocar no primeiro acesso.
              </div>
            </div>
          )}

          {isSuperAdmin && form.perfil === "admin" && (
            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">ACESSO AOS MÓDULOS</label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginTop: 6,
                  padding: "12px 14px",
                  background: "var(--surface2)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={form.adminModulos === null}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        adminModulos: e.target.checked ? null : MODULES.map((m) => m.id),
                      }))
                    }
                  />
                  <span style={{ fontWeight: 600 }}>Acesso total</span>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>(todos os módulos)</span>
                </label>
                <div style={{ height: 1, background: "var(--border)" }} />
                {MODULES.map((m) => {
                  const isChecked = form.adminModulos === null || (form.adminModulos || []).includes(m.id);
                  return (
                    <label
                      key={m.id}
                      style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, paddingLeft: 4 }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const current = form.adminModulos === null ? MODULES.map((x) => x.id) : [...(form.adminModulos || [])];
                          const next = e.target.checked ? [...current, m.id] : current.filter((id) => id !== m.id);
                          const allSelected = MODULES.every((x) => next.includes(x.id));
                          setForm((p) => ({ ...p, adminModulos: allSelected ? null : next }));
                        }}
                      />
                      {m.label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" slot="close">Cancelar</Button>
            <Button onPress={onSalvar} isDisabled={loading}>
              {modal === "novo" ? "Cadastrar" : "Salvar"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
