import { useState } from "react";
import { Button, Modal } from "@heroui/react";
import { useColaboradorDados } from "../../../hooks/queries/useColaboradorDados.js";
import { useBancosCadastrados } from "../../../hooks/queries/useBancosCadastrados.js";
import { useSalvarColaboradorDados } from "../../../hooks/mutations/useColaboradorDadosMutations.js";
import { formatCpf, formatCnpj, formatTelefone, isCpfValido, isCnpjValido } from "../../../lib/documentos.js";
import { PanDatePicker } from "../../../components/ui/PanDatePicker.jsx";
import { PanComboBox } from "../../../components/ui/PanComboBox.jsx";

const FORM_VAZIO = {
  nomeCompleto: "",
  dataNascimento: "",
  dataAdmissao: "",
  rg: "",
  cpf: "",
  cnpj: "",
  emailPessoal: "",
  emailPan: "",
  bancoNome: "",
  bancoAgencia: "",
  bancoConta: "",
  bancoPix: "",
  planoSaude: false,
  planoSaudeQual: "",
  tipoSanguineo: "",
  emergenciaNome: "",
  emergenciaTelefone: "",
};

/**
 * Corpo do form. So monta quando a query ja resolveu (isSuccess), com o
 * estado inicializado por lazy initializer a partir dos dados carregados --
 * nasce certo, sem useEffect(() => setForm(data)). Isso evita
 * react-hooks/set-state-in-effect e o "flash" de campos vazios que um efeito
 * causaria.
 */
function DadosRhForm({ colaborador, dadosIniciais, onClose }) {
  const [form, setForm] = useState(() => ({ ...FORM_VAZIO, ...dadosIniciais }));
  // Sugestoes do campo BANCO. So dispara aqui dentro, ou seja, quando o modal
  // de RH ja foi aberto -- a listagem de colaboradores nao paga por isso.
  const bancos = useBancosCadastrados().data || [];
  const [erro, setErro] = useState("");
  const salvar = useSalvarColaboradorDados();

  const setCampo = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const handleSalvar = async () => {
    setErro("");
    if (form.cpf && !isCpfValido(form.cpf)) {
      setErro("CPF inválido. Confira os números digitados.");
      return;
    }
    if (form.cnpj && !isCnpjValido(form.cnpj)) {
      setErro("CNPJ inválido. Confira os números digitados.");
      return;
    }
    try {
      await salvar.mutateAsync({ colaboradorId: colaborador.id, form });
      onClose();
    } catch (err) {
      setErro(err?.message || "Não foi possível salvar os dados.");
    }
  };

  return (
    <>
      <Modal.Body>
        {erro && (
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
            {erro}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">NOME COMPLETO</label>
          <input
            className="form-input"
            value={form.nomeCompleto}
            onChange={(e) => setCampo("nomeCompleto", e.target.value)}
            placeholder="Nome completo para documentos"
          />
        </div>

        <div className="grid-2" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label className="form-label">DATA DE NASCIMENTO</label>
            <PanDatePicker
              value={form.dataNascimento}
              onChange={(iso) => setCampo("dataNascimento", iso)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">DATA DE ADMISSÃO</label>
            <PanDatePicker
              value={form.dataAdmissao}
              onChange={(iso) => setCampo("dataAdmissao", iso)}
            />
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label className="form-label">RG</label>
            <input
              className="form-input"
              value={form.rg}
              onChange={(e) => setCampo("rg", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">CPF</label>
            <input
              className="form-input"
              value={form.cpf}
              onChange={(e) => setCampo("cpf", formatCpf(e.target.value))}
              placeholder="000.000.000-00"
            />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">CNPJ</label>
          <input
            className="form-input"
            value={form.cnpj}
            onChange={(e) => setCampo("cnpj", formatCnpj(e.target.value))}
            placeholder="00.000.000/0000-00 (se colaborador PJ)"
          />
        </div>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className="form-group">
            <label className="form-label">E-MAIL PESSOAL</label>
            <input
              className="form-input"
              type="email"
              value={form.emailPessoal}
              onChange={(e) => setCampo("emailPessoal", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">E-MAIL PAN</label>
            <input
              className="form-input"
              type="email"
              value={form.emailPan}
              onChange={(e) => setCampo("emailPan", e.target.value)}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          {/* ComboBox do HeroUI: lista tradicional dos bancos ja cadastrados,
              mas allowsCustomValue deixa digitar um banco novo -- que passa a
              aparecer na lista para os proximos cadastros assim que salvo. */}
          <PanComboBox
            label="BANCO"
            value={form.bancoNome}
            onChange={(valor) => setCampo("bancoNome", valor)}
            options={bancos}
            placeholder="Selecione ou digite um novo"
          />
        </div>

        <div className="grid-2" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label className="form-label">AGÊNCIA</label>
            <input
              className="form-input"
              value={form.bancoAgencia}
              onChange={(e) => setCampo("bancoAgencia", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">CONTA</label>
            <input
              className="form-input"
              value={form.bancoConta}
              onChange={(e) => setCampo("bancoConta", e.target.value)}
            />
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">CHAVE PIX</label>
          <input
            className="form-input"
            value={form.bancoPix}
            onChange={(e) => setCampo("bancoPix", e.target.value)}
          />
        </div>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className="form-group">
            <label className="form-label">PLANO DE SAÚDE</label>
            <select
              className="form-input"
              value={form.planoSaude ? "sim" : "nao"}
              onChange={(e) => setCampo("planoSaude", e.target.value === "sim")}
            >
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">QUAL</label>
            <input
              className="form-input"
              value={form.planoSaudeQual}
              onChange={(e) => setCampo("planoSaudeQual", e.target.value)}
              disabled={!form.planoSaude}
              placeholder={form.planoSaude ? "Nome do plano" : "—"}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">TIPO SANGUÍNEO</label>
          <select
            className="form-input"
            value={form.tipoSanguineo}
            onChange={(e) => setCampo("tipoSanguineo", e.target.value)}
          >
            <option value="">Não informado</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((tipo) => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        </div>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className="form-group">
            <label className="form-label">CONTATO DE EMERGÊNCIA</label>
            <input
              className="form-input"
              value={form.emergenciaNome}
              onChange={(e) => setCampo("emergenciaNome", e.target.value)}
              placeholder="Nome"
            />
          </div>
          <div className="form-group">
            <label className="form-label">TELEFONE</label>
            <input
              className="form-input"
              value={form.emergenciaTelefone}
              onChange={(e) => setCampo("emergenciaTelefone", formatTelefone(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="tertiary" onPress={onClose}>Cancelar</Button>
        <Button onPress={handleSalvar} isDisabled={salvar.isPending}>
          {salvar.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </Modal.Footer>
    </>
  );
}

/**
 * Modal separado do ColabModal de proposito: no fluxo de criacao ainda nao
 * existe colaborador_id (o insert so acontece depois da edge
 * create-collaborator), e enfiar 14 campos no ColabModal obrigaria a um
 * segundo write encadeado. Aqui a query so dispara quando alguem abre este
 * modal explicitamente pelo kebab -- editar cargo/aniversario nao toca dados
 * de RH nenhum.
 */
export function DadosRhModal({ colaborador, onClose }) {
  const query = useColaboradorDados(colaborador.id);

  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
    >
      <Modal.Container scroll="inside">
        <Modal.Dialog style={{ maxWidth: 720, border: "1px solid var(--border)" }}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
              Dados RH — {colaborador.nome}
            </Modal.Heading>
          </Modal.Header>

          {query.isLoading && (
            <Modal.Body>
              <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                Carregando...
              </div>
            </Modal.Body>
          )}

          {query.isError && (
            <Modal.Body>
              <div style={{ padding: "24px 0", textAlign: "center", color: "var(--danger)", fontSize: 13 }}>
                Não foi possível carregar os dados. Verifique se você tem acesso ao módulo Colaboradores.
              </div>
            </Modal.Body>
          )}

          {query.isSuccess && (
            <DadosRhForm colaborador={colaborador} dadosIniciais={query.data || {}} onClose={onClose} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
