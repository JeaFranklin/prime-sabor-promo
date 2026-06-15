# Bot Viana — submódulo isolado

> **⚠️ Cliente: Viana Supermercado** (consultoria NERESCO).
> Não confundir com o sistema **Prime Sabor Promo** (este mesmo repo).

## O que é

Assistente WhatsApp consultivo da agenda de fornecedores do Viana Supermercado.
Recebe mensagens começando com `Bot ...` de **Kênia / Duda / Jeã** (números
autorizados) e responde com dados da agenda.

## Comandos suportados

| Mensagem | Intent |
|---|---|
| `Bot hoje` | agenda de hoje |
| `Bot amanhã` | agenda de amanhã |
| `Bot quinta` (ou outro dia da semana) | próxima ocorrência desse dia |
| `Bot 20/06` (ou DD/MM/AAAA) | data específica |
| `Bot pendentes` | 🚨 quem está faltando digitar |
| `Bot semana` | resumo da semana atual |
| `Bot coca` / `Bot 1234` | busca por nome ou código |
| `Bot ajuda` | lista de comandos |

## Como funciona

```
WhatsApp da Kênia/Duda/Jeã
       │ "Bot hoje"
       ▼
Evolution API (VPS 2.25.202.44:8080)
       │ webhook MESSAGES_UPSERT
       ▼
src/app/api/whatsapp/webhook/route.ts
       │ if (isVianaBotMessage(...)) → roteia
       ▼
src/lib/viana/index.ts        ← VOCÊ ESTÁ AQUI
   ├── parser.ts              ← regex PT-BR detecta intent
   ├── agenda.ts              ← lê JSON do Supabase Storage
   ├── handlers.ts            ← formata resposta
   └── envia via enviarWhatsApp() em src/lib/whatsapp.ts
```

## Tabelas no banco (todas com prefixo `viana_`)

- `viana_usuarios_autorizados` — whitelist de números
- `viana_interacoes` — log de conversas

Ver migration `supabase/migrations/006_viana_schema.sql`.

## Variáveis de ambiente

```
VIANA_NUMEROS_AUTORIZADOS=556392197949,556392430636,556392253618
```

Reusa também:
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — banco + storage
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` — envio WhatsApp

## Como a agenda chega no Storage

A planilha `Agenda de Atendimento.xlsx` mora no OneDrive do Jeã. Um cron na
VPS (1x/hora) faz:

```
rclone copy → openpyxl → JSON → supabase storage upload (bucket viana-agenda)
```

Ver: `viana-cron/upload_agenda.py` na VPS (ou task #23 se ainda não rodou).

## Estratégia de saída

Se o Bot Viana crescer (dashboard próprio, mais tabelas, mais usuários),
migrar pro projeto Supabase **neresco-suite** (`jnuiyidhtmffisymtpep`)
já criado e ocioso. Toda a separação foi pensada pra facilitar essa
migração no futuro.
