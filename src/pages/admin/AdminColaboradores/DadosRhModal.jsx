import { useRef, useState } from "react";
import { Button, Modal } from "@heroui/react";
import { useColaboradorDados } from "../../../hooks/queries/useColaboradorDados.js";
import { useBancosCadastrados } from "../../../hooks/queries/useBancosCadastrados.js";
import { useSalvarColaboradorDados } from "../../../hooks/mutations/useColaboradorDadosMutations.js";
import { formatCpf, formatCnpj, formatTelefone, formatCep, soDigitos, isCpfValido, isCnpjValido } from "../../../lib/documentos.js";
import { useBuscaCep } from "../../../hooks/queries/useBuscaCep.js";
import { PanDatePicker } from "../../../components/ui/PanDatePicker.jsx";
import { PanComboBox } from "../../../components/ui/PanComboBox.jsx";
import "../../../styles/dados-rh.css";

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
  enderecoCep: "",
  enderecoLogradouro: "",
  enderecoNumero: "",
  enderecoComplemento: "",
  enderecoBairro: "",
  enderecoCidade: "",
  enderecoUf: "",
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
  const cepLookup = useBuscaCep();
  const [erro, setErro] = useState("");
  const salvar = useSalvarColaboradorDados();
  const numeroRef = useRef(null);

  const setCampo = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  // So sobrescreve logradouro/bairro/cidade/uf -- numero e complemento (predio)
  // continuam sob responsabilidade de quem preenche, o ViaCEP nao sabe disso.
  // Dispara assim que o 8o digito e digitado (nao espera o blur), e joga o
  // foco pro NUMERO -- proximo campo que so a pessoa sabe preencher.
  const handleCepChange = async (valor) => {
    const formatado = formatCep(valor);
    setCampo("enderecoCep", formatado);
    if (soDigitos(formatado).length !== 8) return;

    const endereco = await cepLookup.buscar(formatado);
    if (endereco) {
      setForm((prev) => ({
        ...prev,
        enderecoLogradouro: endereco.logradouro || prev.enderecoLogradouro,
        enderecoBairro: endereco.bairro || prev.enderecoBairro,
        enderecoCidade: endereco.cidade || prev.enderecoCidade,
        enderecoUf: endereco.uf || prev.enderecoUf,
      }));
    }
    numeroRef.current?.focus();
  };

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
          <div className="rh-erro">{erro}</div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="rh-nome-completo">NOME COMPLETO</label>
          <input
            id="rh-nome-completo"
            className="form-input"
            value={form.nomeCompleto}
            onChange={(e) => setCampo("nomeCompleto", e.target.value)}
            placeholder="Nome completo para documentos"
          />
        </div>

        <div className="grid-2 rh-row">
          <div className="form-group">
            <span className="form-label">DATA DE NASCIMENTO</span>
            <PanDatePicker
              value={form.dataNascimento}
              onChange={(iso) => setCampo("dataNascimento", iso)}
            />
          </div>
          <div className="form-group">
            <span className="form-label">DATA DE ADMISSÃO</span>
            <PanDatePicker
              value={form.dataAdmissao}
              onChange={(iso) => setCampo("dataAdmissao", iso)}
            />
          </div>
        </div>

        <div className="grid-2 rh-row">
          <div className="form-group">
            <label className="form-label" htmlFor="rh-rg">RG</label>
            <input
              id="rh-rg"
              className="form-input"
              value={form.rg}
              onChange={(e) => setCampo("rg", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="rh-cpf">CPF</label>
            <input
              id="rh-cpf"
              className="form-input"
              value={form.cpf}
              onChange={(e) => setCampo("cpf", formatCpf(e.target.value))}
              placeholder="000.000.000-00"
            />
          </div>
        </div>

        <div className="form-group rh-row">
          <label className="form-label" htmlFor="rh-cnpj">CNPJ</label>
          <input
            id="rh-cnpj"
            className="form-input"
            value={form.cnpj}
            onChange={(e) => setCampo("cnpj", formatCnpj(e.target.value))}
            placeholder="00.000.000/0000-00 (se colaborador PJ)"
          />
        </div>

        <div className="grid-2 rh-row--grupo">
          <div className="form-group">
            <label className="form-label" htmlFor="rh-email-pessoal">E-MAIL PESSOAL</label>
            <input
              id="rh-email-pessoal"
              className="form-input"
              type="email"
              value={form.emailPessoal}
              onChange={(e) => setCampo("emailPessoal", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="rh-email-pan">E-MAIL PAN</label>
            <input
              id="rh-email-pan"
              className="form-input"
              type="email"
              value={form.emailPan}
              onChange={(e) => setCampo("emailPan", e.target.value)}
            />
          </div>
        </div>

        <div className="grid-2 rh-row--grupo">
          <div className="form-group">
            <label className="form-label" htmlFor="rh-cep">CEP</label>
            <input
              id="rh-cep"
              className="form-input"
              value={form.enderecoCep}
              onChange={(e) => handleCepChange(e.target.value)}
              placeholder="00000-000"
            />
            {cepLookup.buscando && (
              <span className="rh-hint">Buscando endereço...</span>
            )}
            {cepLookup.erro && (
              <span className="rh-hint rh-hint--erro">{cepLookup.erro}</span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="rh-logradouro">LOGRADOURO</label>
            <input
              id="rh-logradouro"
              className="form-input"
              value={form.enderecoLogradouro}
              onChange={(e) => setCampo("enderecoLogradouro", e.target.value)}
              placeholder="Preenchido pelo CEP"
            />
          </div>
        </div>

        <div className="grid-2 rh-row">
          <div className="form-group">
            <label className="form-label" htmlFor="rh-numero">NÚMERO</label>
            <input
              id="rh-numero"
              ref={numeroRef}
              className="form-input"
              value={form.enderecoNumero}
              onChange={(e) => setCampo("enderecoNumero", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="rh-complemento">COMPLEMENTO (APTO/BLOCO)</label>
            <input
              id="rh-complemento"
              className="form-input"
              value={form.enderecoComplemento}
              onChange={(e) => setCampo("enderecoComplemento", e.target.value)}
              placeholder="Se prédio: apartamento, bloco..."
            />
          </div>
        </div>

        <div className="grid-2 rh-row">
          <div className="form-group">
            <label className="form-label" htmlFor="rh-bairro">BAIRRO</label>
            <input
              id="rh-bairro"
              className="form-input"
              value={form.enderecoBairro}
              onChange={(e) => setCampo("enderecoBairro", e.target.value)}
              placeholder="Preenchido pelo CEP"
            />
          </div>
          <div className="form-group">
            <span className="form-label">CIDADE / UF</span>
            <div className="rh-cidade-uf">
              <input
                className="form-input rh-cidade"
                value={form.enderecoCidade}
                onChange={(e) => setCampo("enderecoCidade", e.target.value)}
                placeholder="Preenchido pelo CEP"
              />
              <input
                className="form-input rh-uf"
                value={form.enderecoUf}
                onChange={(e) => setCampo("enderecoUf", e.target.value.toUpperCase().slice(0, 2))}
                placeholder="UF"
              />
            </div>
          </div>
        </div>

        <div className="form-group rh-row--grupo">
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

        <div className="grid-2 rh-row">
          <div className="form-group">
            <label className="form-label" htmlFor="rh-agencia">AGÊNCIA</label>
            <input
              id="rh-agencia"
              className="form-input"
              value={form.bancoAgencia}
              onChange={(e) => setCampo("bancoAgencia", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="rh-conta">CONTA</label>
            <input
              id="rh-conta"
              className="form-input"
              value={form.bancoConta}
              onChange={(e) => setCampo("bancoConta", e.target.value)}
            />
          </div>
        </div>
        <div className="form-group rh-row">
          <label className="form-label" htmlFor="rh-chave-pix">CHAVE PIX</label>
          <input
            id="rh-chave-pix"
            className="form-input"
            value={form.bancoPix}
            onChange={(e) => setCampo("bancoPix", e.target.value)}
          />
        </div>

        <div className="grid-2 rh-row--grupo">
          <div className="form-group">
            <label className="form-label" htmlFor="rh-plano-saude">PLANO DE SAÚDE</label>
            <select
              id="rh-plano-saude"
              className="form-input"
              value={form.planoSaude ? "sim" : "nao"}
              onChange={(e) => setCampo("planoSaude", e.target.value === "sim")}
            >
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="rh-plano-saude-qual">QUAL</label>
            <input
              id="rh-plano-saude-qual"
              className="form-input"
              value={form.planoSaudeQual}
              onChange={(e) => setCampo("planoSaudeQual", e.target.value)}
              disabled={!form.planoSaude}
              placeholder={form.planoSaude ? "Nome do plano" : "—"}
            />
          </div>
        </div>

        <div className="form-group rh-row">
          <label className="form-label" htmlFor="rh-tipo-sanguineo">TIPO SANGUÍNEO</label>
          <select
            id="rh-tipo-sanguineo"
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

        <div className="grid-2 rh-row--grupo">
          <div className="form-group">
            <label className="form-label" htmlFor="rh-emergencia-nome">CONTATO DE EMERGÊNCIA</label>
            <input
              id="rh-emergencia-nome"
              className="form-input"
              value={form.emergenciaNome}
              onChange={(e) => setCampo("emergenciaNome", e.target.value)}
              placeholder="Nome"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="rh-emergencia-telefone">TELEFONE</label>
            <input
              id="rh-emergencia-telefone"
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
        <Modal.Dialog className="rh-dialog">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="rh-heading">
              Dados RH — {colaborador.nome}
            </Modal.Heading>
          </Modal.Header>

          {query.isLoading && (
            <Modal.Body>
              <div className="rh-estado">
                Carregando...
              </div>
            </Modal.Body>
          )}

          {query.isError && (
            <Modal.Body>
              <div className="rh-estado rh-estado--erro">
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
