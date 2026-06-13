/**
 * Template do contrato de PRESTAÇÃO DE SERVIÇOS B2B (Cliente).
 * Base: Código Civil arts. 593-609 + LGPD.
 *
 * Inclui logo do CLIENTE (canto direito) e logo da CONTRATADA (canto esquerdo).
 */

import {
  Document, Page, Text, View, Image, StyleSheet, Font,
} from '@react-pdf/renderer'
import type { ConteudoContratoCliente } from './tipos'
import { dataBR, dataExtenso, moeda, valorExtenso, mascaraDoc } from './formatar'

Font.registerHyphenationCallback((word) => [word])

const c = StyleSheet.create({
  page: {
    paddingTop: 95, paddingBottom: 60, paddingHorizontal: 50,
    fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.45, color: '#111',
  },
  header: {
    position: 'absolute', top: 25, left: 50, right: 50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '1pt solid #888', paddingBottom: 8,
  },
  logo: { width: 90, height: 45, objectFit: 'contain' },
  headerCenter: { fontSize: 8, color: '#555', textAlign: 'center', maxWidth: 200 },
  title: {
    fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'center',
    marginBottom: 14, textTransform: 'uppercase',
  },
  subtitle: { fontSize: 9, textAlign: 'center', color: '#555', marginBottom: 20 },
  paragraph: { textAlign: 'justify', marginBottom: 8 },
  bold: { fontFamily: 'Helvetica-Bold' },
  clauseTitle: {
    fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginTop: 12, marginBottom: 6,
    textTransform: 'uppercase',
  },
  partyBlock: { marginBottom: 6 },
  signatureBlock: { marginTop: 30, textAlign: 'center' },
  signatureLine: {
    borderTop: '1pt solid #000', width: 280, marginTop: 28, marginHorizontal: 'auto',
    paddingTop: 4, textAlign: 'center', fontSize: 9,
  },
  footer: {
    position: 'absolute', bottom: 25, left: 50, right: 50,
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 8, color: '#888', borderTop: '1pt solid #ccc', paddingTop: 6,
  },
  table: { marginVertical: 8, border: '1pt solid #888' },
  trH: { flexDirection: 'row', backgroundColor: '#eee', borderBottom: '1pt solid #888' },
  tr: { flexDirection: 'row', borderBottom: '0.5pt solid #ccc' },
  th: { padding: 5, fontFamily: 'Helvetica-Bold', fontSize: 9, flex: 1 },
  td: { padding: 5, fontSize: 9, flex: 1 },
  tdR: { padding: 5, fontSize: 9, flex: 1, textAlign: 'right' },
})

function P({ children }: { children: React.ReactNode }) {
  return <Text style={c.paragraph}>{children}</Text>
}
function B({ children }: { children: React.ReactNode }) {
  return <Text style={c.bold}>{children}</Text>
}

type Props = { dados: ConteudoContratoCliente }

export function TemplateCliente({ dados }: Props) {
  const { empresa, cliente, servico, numero, qtd_promotoras, valor_total } = dados
  const diariaCliente = qtd_promotoras > 0 && servico.qtd_dias > 0
    ? valor_total / qtd_promotoras / servico.qtd_dias : 0

  return (
    <Document
      title={`Contrato ${numero}`}
      author={empresa.razao_social}
      subject="Contrato de prestação de serviços de promoção"
    >
      <Page size="A4" style={c.page}>
        {/* CABEÇALHO com as DUAS logos (contratada à esquerda, cliente à direita) */}
        <View style={c.header} fixed>
          {empresa.logo_url
            ? <Image src={empresa.logo_url} style={c.logo} />
            : <View style={c.logo} />}
          <Text style={c.headerCenter}>
            Contrato Nº {numero}{'\n'}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>
              {empresa.nome_fantasia || empresa.razao_social}
            </Text>{'\n'}
            CNPJ {mascaraDoc(empresa.cnpj)}
          </Text>
          {cliente.logo_url
            ? <Image src={cliente.logo_url} style={c.logo} />
            : <View style={c.logo} />}
        </View>

        <Text style={c.title}>Contrato de prestação de serviços de promoção e degustação</Text>
        <Text style={c.subtitle}>Nº {numero} — celebrado em {dataExtenso(dados.gerado_em.slice(0, 10))}</Text>

        {/* QUALIFICAÇÃO */}
        <Text style={c.clauseTitle}>I — Qualificação das partes</Text>

        <View style={c.partyBlock}>
          <P>
            <B>CONTRATADA: </B>
            <B>{empresa.razao_social}</B>
            {empresa.nome_fantasia ? ` (${empresa.nome_fantasia})` : ''}, pessoa jurídica de direito
            privado, CNPJ <B>{mascaraDoc(empresa.cnpj)}</B>
            {empresa.endereco_completo ? `, com sede em ${empresa.endereco_completo}` : ''}
            {empresa.cidade ? `, ${empresa.cidade}` : ''}{empresa.estado ? `/${empresa.estado}` : ''}
            {empresa.representante_nome
              ? `, neste ato representada por ${empresa.representante_nome}` +
                (empresa.representante_cpf ? `, CPF ${mascaraDoc(empresa.representante_cpf)}` : '') + '.'
              : '.'}
          </P>
        </View>

        <View style={c.partyBlock}>
          <P>
            <B>CONTRATANTE: </B>
            <B>{cliente.nome_empresa}</B>
            {cliente.cnpj ? `, CNPJ ${mascaraDoc(cliente.cnpj)}` : ''}
            {cliente.cpf ? `, CPF ${mascaraDoc(cliente.cpf)}` : ''}
            {cliente.endereco_completo ? `, ${cliente.endereco_completo}` : ''}
            {cliente.cidade ? `, ${cliente.cidade}` : ''}{cliente.estado ? `/${cliente.estado}` : ''}
            {cliente.responsavel_nome
              ? `, neste ato representada por ${cliente.responsavel_nome}` +
                (cliente.responsavel_cpf ? `, CPF ${mascaraDoc(cliente.responsavel_cpf)}` : '') + '.'
              : '.'}
          </P>
        </View>

        <P>
          As partes acima qualificadas têm entre si justo e contratado o presente <B>Contrato de
          Prestação de Serviços</B>, regido pelos artigos 593 a 609 do <B>Código Civil</B>, pela
          <B> Lei nº 13.709/2018 (LGPD)</B> e demais normas aplicáveis, mediante as cláusulas a seguir.
        </P>

        {/* CLÁUSULA 1 — OBJETO */}
        <Text style={c.clauseTitle}>Cláusula 1ª — Do objeto</Text>
        <P>
          O presente contrato tem por objeto a prestação, pela CONTRATADA, de <B>serviços
          profissionais de promoção, degustação e/ou demonstração de produtos</B> em ponto de venda,
          mediante o emprego de promotoras devidamente qualificadas, no âmbito do projeto denominado
          <B> "{servico.nome}"</B>{servico.descricao ? `, com a seguinte descrição: ${servico.descricao}` : ''}.
        </P>

        {/* CLÁUSULA 2 — PRAZO */}
        <Text style={c.clauseTitle}>Cláusula 2ª — Do prazo e cronograma</Text>
        <P>
          Os serviços terão início em <B>{dataBR(servico.data_inicio)}</B> e término em
          <B> {dataBR(servico.data_fim)}</B>, perfazendo <B>{servico.qtd_dias} dias corridos</B> de
          execução, a serem realizados em <B>{servico.local_completo}</B>
          {servico.horario_inicio ? `, no horário a partir das ${servico.horario_inicio.substring(0, 5)}` : ''}.
        </P>

        {/* CLÁUSULA 3 — EQUIPE */}
        <Text style={c.clauseTitle}>Cláusula 3ª — Da equipe alocada</Text>
        <P>
          A CONTRATADA alocará <B>{qtd_promotoras} ({valorExtenso(qtd_promotoras).replace(/ reais?| centavos?/g, '').trim()})
          promotora{qtd_promotoras > 1 ? 's' : ''}</B> para o serviço, todas vinculadas à CONTRATADA por
          contratos próprios de prestação de serviços autônoma, sem qualquer vínculo empregatício com
          o CONTRATANTE.
        </P>

        {/* CLÁUSULA 4 — VALOR */}
        <Text style={c.clauseTitle}>Cláusula 4ª — Do preço</Text>
        <P>
          Pelos serviços ora contratados, o CONTRATANTE pagará à CONTRATADA o valor total de
          <B> {moeda(valor_total)}</B> ({valorExtenso(valor_total)}), conforme composição:
        </P>

        <View style={c.table}>
          <View style={c.trH}>
            <Text style={c.th}>Descrição</Text>
            <Text style={c.th}>Qtd</Text>
            <Text style={c.th}>Diária</Text>
            <Text style={c.th}>Subtotal</Text>
          </View>
          <View style={c.tr}>
            <Text style={c.td}>Promotoras × Dias</Text>
            <Text style={c.td}>{qtd_promotoras} × {servico.qtd_dias}</Text>
            <Text style={c.td}>{moeda(diariaCliente)}</Text>
            <Text style={c.tdR}>{moeda(valor_total)}</Text>
          </View>
        </View>

        {/* CLÁUSULA 5 — PAGAMENTO (dinâmica conforme tem_sinal / prazo) */}
        <Text style={c.clauseTitle}>Cláusula 5ª — Da forma de pagamento</Text>
        {servico.tem_sinal && servico.sinal_pct ? (
          <>
            <P>
              O pagamento será realizado em <B>2 (duas) parcelas</B>:
              {'\n'}<B>a)</B> <B>{servico.sinal_pct}%</B> ({moeda(valor_total * (servico.sinal_pct / 100))}) na
              assinatura deste contrato, a título de sinal e princípio de pagamento; e
              {'\n'}<B>b)</B> <B>{100 - servico.sinal_pct}%</B> ({moeda(valor_total * ((100 - servico.sinal_pct) / 100))})
              em até <B>{servico.prazo_pagamento_dias || 30} dias</B> contados da emissão da
              Nota Fiscal de Serviços, com vencimento previsto para
              <B> {dataBR(servico.data_pagamento_cliente)}</B>.
            </P>
          </>
        ) : (
          <P>
            O pagamento será realizado em <B>parcela única</B>, em até
            <B> {servico.prazo_pagamento_dias || 30} dias</B> contados da emissão da Nota Fiscal de
            Serviços, com vencimento previsto para <B>{dataBR(servico.data_pagamento_cliente)}</B>.
          </P>
        )}
        <P>
          <B>§1º.</B> A emissão da Nota Fiscal está prevista para
          <B> {dataBR(servico.data_emissao_nf)}</B>, podendo ser antecipada ou postergada mediante
          acordo entre as partes.
        </P>
        <P>
          <B>§2º.</B> O atraso no pagamento sujeitará o CONTRATANTE à incidência de juros de mora de
          <B> 1% ao mês</B>, multa de <B>2%</B> e correção pelo IGP-M/FGV, sem prejuízo da rescisão
          prevista na Cláusula 14ª.
        </P>

        {/* CLÁUSULA 6 — OBRIGAÇÕES CONTRATADA */}
        <Text style={c.clauseTitle}>Cláusula 6ª — Das obrigações da contratada</Text>
        <P>
          <B>a)</B> selecionar e capacitar as promotoras conforme briefing;
          {'\n'}<B>b)</B> entregar uniforme e materiais técnicos em comodato;
          {'\n'}<B>c)</B> coordenar a execução, escala e substituições em caso de imprevisto;
          {'\n'}<B>d)</B> entregar relatório pós-serviço com fotos, observações e métricas combinadas;
          {'\n'}<B>e)</B> manter regularidade fiscal e emitir nota fiscal eletrônica de serviços.
        </P>

        {/* CLÁUSULA 7 — OBRIGAÇÕES CONTRATANTE */}
        <Text style={c.clauseTitle}>Cláusula 7ª — Das obrigações do contratante</Text>
        <P>
          <B>a)</B> fornecer briefing técnico do produto, posicionamento e meta de execução com
          antecedência mínima de <B>72 (setenta e duas) horas</B> do início;
          {'\n'}<B>b)</B> garantir acesso ao PDV e às áreas necessárias à execução;
          {'\n'}<B>c)</B> efetuar os pagamentos nos prazos pactuados;
          {'\n'}<B>d)</B> abster-se de praticar atos de subordinação direta às promotoras, que se
          reportarão exclusivamente à coordenação da CONTRATADA.
        </P>

        {/* CLÁUSULA 8 — PROPRIEDADE INTELECTUAL */}
        <Text style={c.clauseTitle}>Cláusula 8ª — Da propriedade intelectual</Text>
        <P>
          O material visual e relatórios produzidos durante a execução serão de propriedade do
          CONTRATANTE, podendo a CONTRATADA utilizá-los em seu portfólio interno, mediante prévia
          autorização escrita.
        </P>

        {/* CLÁUSULA 9 — RESPONSABILIDADE */}
        <Text style={c.clauseTitle}>Cláusula 9ª — Da responsabilidade civil</Text>
        <P>
          A CONTRATADA responde por eventuais danos diretos causados por suas promotoras durante a
          execução do serviço, no limite do <B>valor total deste contrato</B>, excluídos danos
          indiretos, lucros cessantes ou prejuízos consequenciais.
        </P>

        {/* CLÁUSULA 10 — CONFIDENCIALIDADE */}
        <Text style={c.clauseTitle}>Cláusula 10ª — Da confidencialidade</Text>
        <P>
          As partes obrigam-se a manter <B>sigilo</B> sobre todas as informações comerciais,
          estratégicas e técnicas trocadas durante a vigência deste contrato e por <B>5 (cinco) anos</B>
          após seu término. As promotoras assinam termo equivalente, conforme Cláusula 8ª do contrato
          individual de cada uma.
        </P>

        {/* CLÁUSULA 11 — LGPD */}
        <Text style={c.clauseTitle}>Cláusula 11ª — Da proteção de dados pessoais (LGPD)</Text>
        <P>
          As partes obrigam-se a observar a <B>Lei nº 13.709/2018 (LGPD)</B> no tratamento de dados
          pessoais. A CONTRATADA atuará como <B>operadora</B> dos dados de consumidores eventualmente
          coletados em PDV em nome do CONTRATANTE, controlador. Cada parte é responsável pelas
          sanções administrativas que vier a causar por descumprimento da legislação de proteção de
          dados.
        </P>

        {/* CLÁUSULA 12 — FORÇA MAIOR */}
        <Text style={c.clauseTitle}>Cláusula 12ª — Do caso fortuito e da força maior</Text>
        <P>
          Nenhuma das partes responderá pelo descumprimento decorrente de caso fortuito ou força
          maior (art. 393 do Código Civil), incluindo, sem limitação, calamidades públicas,
          determinações governamentais e falhas em redes elétricas/telecomunicações de impacto
          regional.
        </P>

        {/* CLÁUSULA 13 — CANCELAMENTO */}
        <Text style={c.clauseTitle}>Cláusula 13ª — Do cancelamento e remarcação</Text>
        <P>
          O cancelamento ou remarcação solicitado pelo CONTRATANTE com antecedência inferior a
          <B> 5 (cinco) dias corridos</B> do início do serviço implicará retenção do sinal pago
          (50%) a título de cobertura dos custos já incorridos com seleção, capacitação e logística.
        </P>

        {/* CLÁUSULA 14 — RESCISÃO */}
        <Text style={c.clauseTitle}>Cláusula 14ª — Da rescisão</Text>
        <P>
          O presente contrato poderá ser rescindido por <B>distrato</B>, por <B>justa causa</B> em
          razão de descumprimento de obrigação essencial, ou por <B>resilição unilateral</B> com
          aviso prévio de <B>15 (quinze) dias</B>. Em caso de rescisão por justa causa por culpa de
          uma das partes, esta arcará com a multa prevista na Cláusula 15ª.
        </P>

        {/* CLÁUSULA 15 — MULTA */}
        <Text style={c.clauseTitle}>Cláusula 15ª — Da multa</Text>
        <P>
          A parte que der causa à rescisão por descumprimento de obrigação essencial pagará à outra
          multa de <B>20% (vinte por cento)</B> sobre o valor total deste contrato, sem prejuízo de
          perdas e danos comprovadamente apurados.
        </P>

        {/* CLÁUSULA 16 — DISPOSIÇÕES GERAIS */}
        <Text style={c.clauseTitle}>Cláusula 16ª — Das disposições gerais</Text>
        <P>
          <B>§1º.</B> Quaisquer alterações neste contrato serão objeto de termo aditivo escrito.
        </P>
        <P>
          <B>§2º.</B> Este contrato é firmado por aceite eletrônico, com plena validade jurídica nos
          termos da <B>MP 2.200-2/2001, art. 10, §2º</B>.
        </P>

        {/* CLÁUSULA 17 — FORO */}
        <Text style={c.clauseTitle}>Cláusula 17ª — Do foro</Text>
        <P>
          Fica eleito o foro da Comarca de <B>{empresa.foro_cidade || 'sede da CONTRATADA'}
          {empresa.foro_estado ? `/${empresa.foro_estado}` : ''}</B>, com renúncia a qualquer outro,
          para dirimir quaisquer controvérsias oriundas deste instrumento.
        </P>

        {/* ASSINATURAS */}
        <View style={c.signatureBlock} wrap={false}>
          <Text style={{ marginTop: 18 }}>
            E, por estarem assim justas e contratadas, as partes firmam o presente instrumento por
            meio de aceite eletrônico.
          </Text>
          <Text style={{ marginTop: 8 }}>
            {empresa.cidade || ''}{empresa.estado ? `/${empresa.estado}` : ''}, {dataExtenso(dados.gerado_em.slice(0, 10))}.
          </Text>

          <View style={c.signatureLine}>
            <Text>{empresa.razao_social}</Text>
            <Text style={{ fontSize: 8, color: '#555' }}>CONTRATADA</Text>
          </View>

          <View style={c.signatureLine}>
            <Text>{cliente.nome_empresa}</Text>
            <Text style={{ fontSize: 8, color: '#555' }}>CONTRATANTE</Text>
          </View>
        </View>

        <View style={c.footer} fixed>
          <Text>Contrato {numero}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
