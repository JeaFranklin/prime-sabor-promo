/**
 * Template do contrato de PRESTAÇÃO DE SERVIÇOS AUTÔNOMA (Promotora).
 * Base: Código Civil arts. 593-609 + CLT art. 442-B + LGPD.
 *
 * Cláusulas redigidas para AFASTAR vínculo empregatício:
 *   • autonomia expressa     • sem subordinação    • sem exclusividade
 *   • sem horário fixo       • equipamentos próprios
 *   • pagamento por serviço  • possibilidade de substituição
 *
 * ATENÇÃO: a operação real precisa refletir essa autonomia. Contrato sozinho
 * não impede vínculo se na prática houver pessoalidade + subordinação +
 * não-eventualidade + onerosidade (princípio da primazia da realidade — TST).
 */

import {
  Document, Page, Text, View, Image, StyleSheet, Font,
} from '@react-pdf/renderer'
import type { ConteudoContratoPromotora } from './tipos'
import {
  dataBR, dataExtenso, moeda, valorExtenso, mascaraDoc,
} from './formatar'

// Fontes — Helvetica vem embutida no PDF, suficiente para PT-BR.
Font.registerHyphenationCallback((word) => [word])  // desliga quebra agressiva

const c = StyleSheet.create({
  page: {
    paddingTop: 90, paddingBottom: 60, paddingHorizontal: 50,
    fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.45, color: '#111',
  },
  header: {
    position: 'absolute', top: 25, left: 50, right: 50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '1pt solid #888', paddingBottom: 8,
  },
  logo: { width: 90, height: 40, objectFit: 'contain' },
  headerRight: { fontSize: 8, color: '#555', textAlign: 'right' },
  title: {
    fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'center',
    marginBottom: 16, textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 9, textAlign: 'center', color: '#555', marginBottom: 20,
  },
  paragraph: { textAlign: 'justify', marginBottom: 8 },
  bold: { fontFamily: 'Helvetica-Bold' },
  italic: { fontFamily: 'Helvetica-Oblique' },
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
})

type Props = { dados: ConteudoContratoPromotora }

// Componente de parágrafo com possibilidade de partes em negrito
function P({ children }: { children: React.ReactNode }) {
  return <Text style={c.paragraph}>{children}</Text>
}
function B({ children }: { children: React.ReactNode }) {
  return <Text style={c.bold}>{children}</Text>
}

export function TemplatePromotora({ dados }: Props) {
  const { empresa, promotora, servico, numero, valor_total_promotora, cliente_nome } = dados
  const total = valor_total_promotora
  const diaria = servico.valor_diaria || 0
  const ehMEI = !!promotora.cnpj_mei

  return (
    <Document
      title={`Contrato ${numero}`}
      author={empresa.razao_social}
      subject="Contrato de prestação de serviços autônoma"
    >
      <Page size="A4" style={c.page}>
        {/* CABEÇALHO — fixo em todas as páginas */}
        <View style={c.header} fixed>
          {empresa.logo_url ? <Image src={empresa.logo_url} style={c.logo} /> : <View />}
          <Text style={c.headerRight}>
            {empresa.nome_fantasia || empresa.razao_social}{'\n'}
            CNPJ {mascaraDoc(empresa.cnpj)}{'\n'}
            Contrato Nº {numero}
          </Text>
        </View>

        <Text style={c.title}>Contrato de prestação de serviços autônoma</Text>
        <Text style={c.subtitle}>Nº {numero} — celebrado em {dataExtenso(dados.gerado_em.slice(0, 10))}</Text>

        {/* QUALIFICAÇÃO DAS PARTES */}
        <Text style={c.clauseTitle}>I — Qualificação das partes</Text>

        <View style={c.partyBlock}>
          <P>
            <B>CONTRATANTE: </B>
            <B>{empresa.razao_social}</B>
            {empresa.nome_fantasia ? ` (${empresa.nome_fantasia})` : ''}, pessoa jurídica de direito privado,
            inscrita no CNPJ sob o nº <B>{mascaraDoc(empresa.cnpj)}</B>
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
            <B>CONTRATADA: </B>
            <B>{promotora.nome}</B>, profissional autônoma
            {ehMEI ? ', exercendo atividade como Microempreendedora Individual (MEI)' : ''}
            {promotora.cpf ? `, inscrita no CPF sob o nº ${mascaraDoc(promotora.cpf)}` : ''}
            {ehMEI && promotora.cnpj_mei ? `, CNPJ ${mascaraDoc(promotora.cnpj_mei)}` : ''}
            {promotora.rg ? `, RG nº ${promotora.rg}` : ''}
            {promotora.endereco_completo ? `, residente em ${promotora.endereco_completo}` : ''}
            {promotora.cidade ? `, ${promotora.cidade}` : ''}{promotora.estado ? `/${promotora.estado}` : ''}.
          </P>
        </View>

        <P>
          As partes acima qualificadas têm entre si justo e contratado o presente <B>Contrato de
          Prestação de Serviços Autônoma</B>, regido pelos artigos 593 a 609 do <B>Código Civil</B> e
          pelo artigo 442-B da <B>Consolidação das Leis do Trabalho</B>, mediante as cláusulas e condições
          a seguir.
        </P>

        {/* CLÁUSULA 1 — OBJETO */}
        <Text style={c.clauseTitle}>Cláusula 1ª — Do objeto</Text>
        <P>
          O presente contrato tem por objeto a <B>prestação de serviços autônomos de promoção,
          degustação e/ou demonstração de produtos</B> pela CONTRATADA, em favor do cliente final
          <B> {cliente_nome}</B>, no âmbito do serviço denominado <B>"{servico.nome}"</B>
          {servico.local_completo ? `, a ser executado em ${servico.local_completo}` : ''}.
          {servico.descricao ? ` Descrição complementar: ${servico.descricao}` : ''}
        </P>

        {/* CLÁUSULA 2 — PRAZO */}
        <Text style={c.clauseTitle}>Cláusula 2ª — Do prazo</Text>
        <P>
          A prestação dos serviços iniciar-se-á em <B>{dataBR(servico.data_inicio)}</B> e encerrar-se-á em
          <B> {dataBR(servico.data_fim)}</B>, perfazendo o total de <B>{servico.qtd_dias} (
          {valorExtenso(servico.qtd_dias).replace(/ reais?| centavos?/g, '').trim()}) dias</B> corridos
          de execução. Não há renovação automática deste contrato, devendo qualquer prorrogação ser
          objeto de aditivo escrito.
        </P>

        {/* CLÁUSULA 3 — REMUNERAÇÃO (com data fixa de pagamento) */}
        <Text style={c.clauseTitle}>Cláusula 3ª — Da remuneração</Text>
        <P>
          Pela prestação dos serviços ora contratados, a CONTRATANTE pagará à CONTRATADA o valor
          de <B>{moeda(diaria)}</B> por diária de serviço efetivamente prestada, totalizando o
          montante de <B>{moeda(total)}</B>{' '}
          ({valorExtenso(total)}).
        </P>
        <P>
          <B>§1º.</B> O pagamento será realizado no dia
          {servico.data_pagamento_promotora
            ? <> <B>{dataBR(servico.data_pagamento_promotora)}</B></>
            : <> a ser informado pela CONTRATANTE em até 10 (dez) dias úteis após a conclusão do serviço</>},
          por meio de transferência bancária ou chave PIX
          {promotora.chave_pix ? ` (${promotora.chave_pix})` : ''}.
        </P>
        <P>
          <B>§2º.</B> Os valores aqui pactuados constituem <B>remuneração por serviço prestado</B>,
          de natureza estritamente civil, não se configurando como salário, vencimento, ordenado ou
          qualquer outra verba de natureza trabalhista.
        </P>

        {/* CLÁUSULA 4 — NATUREZA AUTÔNOMA (CRÍTICA) */}
        <Text style={c.clauseTitle}>Cláusula 4ª — Da natureza autônoma da prestação</Text>
        <P>
          As partes reconhecem e declaram expressamente que o presente contrato tem natureza
          <B> estritamente civil</B>, regido pelos artigos 593 a 609 do Código Civil e pelo artigo
          442-B da CLT, <B>inexistindo entre elas qualquer vínculo empregatício</B>, nos termos do
          artigo 3º da Consolidação das Leis do Trabalho.
        </P>
        <P>
          <B>§1º. Ausência de subordinação.</B> A CONTRATADA executará os serviços com plena autonomia
          técnica e organizacional, não estando sujeita a ordens, direção, fiscalização ou poder
          disciplinar da CONTRATANTE, observadas apenas as diretrizes técnicas do briefing e o horário
          de funcionamento do evento.
        </P>
        <P>
          <B>§2º. Ausência de exclusividade.</B> Não há qualquer cláusula de exclusividade, podendo a
          CONTRATADA prestar serviços simultâneos a outros tomadores, inclusive concorrentes,
          respeitada apenas a confidencialidade prevista na Cláusula 8ª.
        </P>
        <P>
          <B>§3º. Equipamentos e meios próprios.</B> A CONTRATADA executará os serviços com seus
          próprios meios e equipamentos (vestuário básico, transporte, materiais pessoais), sendo o
          uniforme específico do evento, quando exigido, cedido em comodato pela CONTRATANTE e
          restituído ao final.
        </P>
        <P>
          <B>§4º. Possibilidade de substituição.</B> Em caso de impossibilidade pessoal de
          comparecimento, a CONTRATADA poderá, mediante prévia comunicação e aceitação da CONTRATANTE,
          indicar profissional substituto de qualificação equivalente, afastando-se a pessoalidade.
        </P>

        {/* CLÁUSULA 5 — OBRIGAÇÕES DA CONTRATADA */}
        <Text style={c.clauseTitle}>Cláusula 5ª — Das obrigações da contratada</Text>
        <P>
          Constituem obrigações da CONTRATADA:
          {'\n'}<B>a)</B> executar os serviços com diligência, técnica e zelo profissional;
          {'\n'}<B>b)</B> comparecer pontualmente ao local do evento no horário previamente acordado;
          {'\n'}<B>c)</B> trajar o uniforme cedido pela CONTRATANTE, mantendo apresentação pessoal adequada;
          {'\n'}<B>d)</B> manter postura ética e cordial com consumidores, equipe do PDV e
          representantes do cliente final;
          {'\n'}<B>e)</B> entregar relatório pós-serviço, com fotos e observações pertinentes;
          {'\n'}<B>f)</B> arcar com seus próprios tributos, contribuições previdenciárias (INSS como
          contribuinte individual) e demais encargos legais decorrentes de sua atividade autônoma.
        </P>

        {/* CLÁUSULA 6 — OBRIGAÇÕES DA CONTRATANTE */}
        <Text style={c.clauseTitle}>Cláusula 6ª — Das obrigações da contratante</Text>
        <P>
          Constituem obrigações da CONTRATANTE:
          {'\n'}<B>a)</B> informar com antecedência local, data, horário e diretrizes técnicas (briefing);
          {'\n'}<B>b)</B> fornecer uniforme em comodato, quando exigido pelo cliente final;
          {'\n'}<B>c)</B> efetuar o pagamento da remuneração nos prazos pactuados na Cláusula 3ª;
          {'\n'}<B>d)</B> respeitar a autonomia da CONTRATADA, abstendo-se de praticar atos
          característicos de subordinação empregatícia.
        </P>

        {/* CLÁUSULA 7 — RESPONSABILIDADE CIVIL */}
        <Text style={c.clauseTitle}>Cláusula 7ª — Da responsabilidade civil</Text>
        <P>
          Cada parte responde, perante terceiros e perante a outra, exclusivamente pelos atos
          praticados por si ou por seus prepostos, na forma dos artigos 186 e 927 do Código Civil.
        </P>

        {/* CLÁUSULA 8 — CONFIDENCIALIDADE */}
        <Text style={c.clauseTitle}>Cláusula 8ª — Da confidencialidade</Text>
        <P>
          A CONTRATADA obriga-se a manter <B>sigilo absoluto</B> sobre informações estratégicas,
          comerciais, técnicas e operacionais a que tiver acesso em decorrência deste contrato,
          inclusive sobre dados de consumidores, lançamentos de produtos e estratégias de PDV do
          cliente final, sob pena de responsabilização civil pelos prejuízos causados, sem prejuízo da
          multa prevista na Cláusula 13ª. O dever de sigilo subsiste por <B>5 (cinco) anos</B> após o
          término deste contrato.
        </P>

        {/* CLÁUSULA 9 — LGPD */}
        <Text style={c.clauseTitle}>Cláusula 9ª — Da proteção de dados pessoais (LGPD)</Text>
        <P>
          As partes obrigam-se a tratar os dados pessoais a que tenham acesso em estrita observância à
          <B> Lei nº 13.709/2018 (LGPD)</B>. A CONTRATANTE tratará os dados da CONTRATADA com base
          legal na <B>execução de contrato</B> (art. 7º, V, LGPD) e no <B>cumprimento de obrigação
          legal</B> (art. 7º, II), pelo prazo necessário ao cumprimento das obrigações fiscais,
          previdenciárias e trabalhistas (mínimo de 5 anos). A CONTRATADA poderá, a qualquer tempo,
          exercer os direitos previstos no art. 18 da LGPD, mediante solicitação ao e-mail
          {empresa.email ? ` ${empresa.email}` : ' indicado no cabeçalho deste instrumento'}.
        </P>

        {/* CLÁUSULA 10 — PROPRIEDADE INTELECTUAL */}
        <Text style={c.clauseTitle}>Cláusula 10ª — Da propriedade do material produzido</Text>
        <P>
          Todo material visual produzido durante a execução dos serviços (fotos, vídeos, relatórios,
          observações de PDV) pertence integralmente à CONTRATANTE e ao cliente final, podendo ser
          utilizado para fins comerciais, de marketing e portfólio, sem que disso decorra qualquer
          remuneração adicional à CONTRATADA, que desde já cede os respectivos direitos patrimoniais
          de imagem nos termos do art. 20 do Código Civil.
        </P>

        {/* CLÁUSULA 11 — RESCISÃO */}
        <Text style={c.clauseTitle}>Cláusula 11ª — Da rescisão</Text>
        <P>
          O presente contrato poderá ser rescindido:
          {'\n'}<B>a)</B> pela conclusão natural do prazo previsto na Cláusula 2ª;
          {'\n'}<B>b)</B> por <B>distrato</B>, mediante acordo escrito entre as partes;
          {'\n'}<B>c)</B> por <B>justa causa</B>, em caso de descumprimento de obrigação essencial,
          mediante notificação escrita;
          {'\n'}<B>d)</B> por <B>desistência</B> de qualquer das partes, com aviso prévio mínimo de
          <B> 48 (quarenta e oito) horas</B> antes do início do serviço, sem ônus.
        </P>
        <P>
          <B>Parágrafo único.</B> A desistência da CONTRATADA com prazo inferior ao previsto na alínea
          "d", ou o abandono do serviço já iniciado sem motivo justificado, sujeitará a CONTRATADA à
          multa prevista na Cláusula 13ª, sem prejuízo da reparação por perdas e danos comprovados.
        </P>

        {/* CLÁUSULA 12 — CASO FORTUITO */}
        <Text style={c.clauseTitle}>Cláusula 12ª — Do caso fortuito e da força maior</Text>
        <P>
          Nenhuma das partes responderá por descumprimento decorrente de caso fortuito ou força maior,
          nos termos do art. 393 do Código Civil, devendo a parte afetada comunicar imediatamente à
          outra a ocorrência do evento.
        </P>

        {/* CLÁUSULA 13 — MULTA */}
        <Text style={c.clauseTitle}>Cláusula 13ª — Da multa</Text>
        <P>
          O descumprimento de qualquer cláusula deste contrato sujeitará a parte infratora à multa
          equivalente a <B>10% (dez por cento)</B> do valor total contratado, sem prejuízo de perdas
          e danos comprovadamente apurados (Código Civil, art. 408 e seguintes).
        </P>

        {/* CLÁUSULA 14 — DISPOSIÇÕES GERAIS */}
        <Text style={c.clauseTitle}>Cláusula 14ª — Das disposições gerais</Text>
        <P>
          <B>§1º.</B> Eventual tolerância de qualquer das partes quanto ao descumprimento das
          obrigações da outra não constituirá novação, renúncia ou modificação do pactuado.
        </P>
        <P>
          <B>§2º.</B> Este contrato é firmado por <B>aceite eletrônico</B>, com registro de data,
          horário, endereço IP e identificação do aceitante, possuindo plena validade jurídica nos
          termos da <B>Medida Provisória nº 2.200-2/2001, art. 10, §2º</B>.
        </P>

        {/* CLÁUSULA 15 — FORO */}
        <Text style={c.clauseTitle}>Cláusula 15ª — Do foro</Text>
        <P>
          Fica eleito o foro da Comarca de <B>{empresa.foro_cidade || 'sede da CONTRATANTE'}
          {empresa.foro_estado ? `/${empresa.foro_estado}` : ''}</B>, com renúncia expressa a qualquer
          outro por mais privilegiado que seja, para dirimir quaisquer controvérsias oriundas deste
          contrato.
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
            <Text style={{ fontSize: 8, color: '#555' }}>CONTRATANTE</Text>
          </View>

          <View style={c.signatureLine}>
            <Text>{promotora.nome}</Text>
            <Text style={{ fontSize: 8, color: '#555' }}>
              CONTRATADA — CPF {mascaraDoc(promotora.cpf || '')}
            </Text>
          </View>
        </View>

        {/* RODAPÉ — paginação automática */}
        <View style={c.footer} fixed>
          <Text>Contrato {numero}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
