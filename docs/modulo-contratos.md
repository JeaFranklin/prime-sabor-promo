# Módulo de Contratos e Documentos

> Geração automática de contratos para serviços com duração **≥ 5 dias corridos**,
> com envio por WhatsApp e aceite eletrônico válido juridicamente.

## Visão geral

```
┌──────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│ Cria/edita serviço   │ ──► │ qtd_dias >= 5 ?      │ ──► │ Gera contratos  │
│  (servicos/novo)     │     │ (data_fim − inicio)  │     │  cliente + N    │
└──────────────────────┘     └──────────────────────┘     │  promotoras     │
                                                          └────────┬────────┘
                                                                   │
                              ┌────────────────────────────────────┘
                              ▼
                  ┌──────────────────────┐     ┌──────────────────────┐
                  │ Renderiza PDF        │ ──► │ Sobe pro Storage     │
                  │ (@react-pdf/renderer)│     │ (bucket 'contratos') │
                  └──────────┬───────────┘     └──────────┬───────────┘
                             │                            │
                             ▼                            ▼
              ┌──────────────────────┐     ┌──────────────────────┐
              │ Envia PDF + link de  │     │ Signed URL 7 dias    │
              │ aceite por WhatsApp  │     └──────────────────────┘
              └──────────┬───────────┘
                         │
                         ▼
            ┌─────────────────────────────────┐
            │ /contratos/aceite/[token]       │
            │   • lê o PDF                    │
            │   • digita nome completo        │
            │   • marca "li e concordo"       │
            │   • clica ACEITAR               │
            │ → grava IP, UA, data, nome      │
            └─────────────────────────────────┘
```

## Bases legais

| Norma | O que cobre |
|-------|-------------|
| **Código Civil arts. 593-609** | Contrato de prestação de serviços (autônomo) |
| **CLT art. 442-B** (Lei 13.467/2017) | Permite contratação de autônomo contínuo SEM vínculo CLT, desde que sem subordinação |
| **Lei 13.709/2018 (LGPD)** | Cláusula obrigatória em todo contrato que trate dados pessoais |
| **MP 2.200-2/2001 art. 10 §2º** | Documento eletrônico tem valor jurídico quando há prova da autoria (ex.: registro de IP + nome digitado + aceite) |

## Risco trabalhista (LEIA ISTO)

A jurisprudência do **TST** aplica o **princípio da primazia da realidade**: se na operação real
houver os 4 requisitos do art. 3º da CLT — *pessoalidade, não-eventualidade, onerosidade e
subordinação* — o juiz reconhece **vínculo de emprego** mesmo com contrato dizendo "autônomo".

Para mitigar:

- ✅ **Contrato escrito** com cláusula expressa de autonomia, ausência de subordinação,
      inexistência de exclusividade, equipamentos próprios e possibilidade de substituição.
- ✅ **Operação real coerente**: não dar ordens diretas, não exigir horário rígido (apenas
      o horário do evento), não exigir exclusividade entre serviços.
- ✅ **Preferência por promotoras MEI** (relação B2B reduz drasticamente o risco).
- ⚠️ **Não usar** termos como "salário", "funcionário", "subordinado", "férias" nos contratos.
- ⚠️ Pagamento como **diária por serviço**, nunca como mensalidade fixa.

## Estrutura de pastas

```
src/
├── app/
│   ├── api/
│   │   └── contratos/
│   │       ├── gerar/route.ts         → POST: gera contratos de um serviço
│   │       └── aceite/[token]/route.ts → POST: registra aceite eletrônico
│   ├── contratos/
│   │   ├── page.tsx                   → listagem geral
│   │   ├── [id]/page.tsx              → detalhe + reenviar
│   │   └── aceite/[token]/page.tsx    → página pública de aceite
├── lib/
│   └── contratos/
│       ├── tipos.ts                   → tipos TS compartilhados
│       ├── numeracao.ts               → próximo CT-YYYY-NNNN
│       ├── template-cliente.tsx       → React-PDF do contrato de cliente
│       ├── template-promotora.tsx     → React-PDF do contrato de promotora
│       ├── gerar-pdf.ts               → renderiza + upload + signed URL
│       └── automacao.ts               → trigger >= 5 dias
└── supabase/migrations/
    └── 001_contratos_documentos.sql
```

## Variáveis de ambiente adicionais

```
# .env.local — já existentes do projeto
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # NOVO — necessário p/ uploads no Storage server-side
EVOLUTION_API_URL=...
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE=gustpro

# Novo
APP_URL=https://primesabor.vercel.app   # base para o link público de aceite
```

## Como rodar a migration

1. Abra o Supabase → SQL Editor.
2. Cole o conteúdo de `supabase/migrations/001_contratos_documentos.sql`.
3. **Crie os 2 buckets de Storage** (Storage → New bucket):
   - `contratos`  → **Private**, file size limit 10 MB, allowed MIME `application/pdf`
   - `documentos` → **Private**, file size limit 20 MB

## Numeração

Formato: `CT-YYYY-NNNN`. NNNN reinicia a cada ano. Lógica fica em `lib/contratos/numeracao.ts`
(SELECT max do ano corrente + 1, com lock pra evitar duplicidade).
