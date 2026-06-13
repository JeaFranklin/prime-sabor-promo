# Integração WhatsApp — GustPro (Evolution API)

> Fonte da verdade da integração de WhatsApp do GustPro. Atualize aqui quando algo mudar.

## O que é

O GustPro envia mensagens automáticas de WhatsApp para as promotoras via **Evolution API
v1.8.7** (open-source, auto-hospedada numa VPS). Não é a API oficial da Meta — usa um
número de WhatsApp comum conectado via QR Code.

> ⚠️ **Versão importa!** Usar a **v1.8.7** (não a v2.x/`latest`, que tem bug que impede
> gerar o QR Code). O formato de request abaixo é o da v1.x.

## Infraestrutura

| Item | Valor |
|---|---|
| VPS | `2.25.202.44`, porta `8080` (aberta, protegida por apikey) |
| Imagem Docker | `atendai/evolution-api:v1.8.7` (file store, sem PostgreSQL/Redis) |
| Pasta na VPS | `/opt/evolution/` |
| Instância | `gustpro` (número brasileiro conectado via QR) |
| Manager (web) | `http://2.25.202.44:8080/manager` |

## Credenciais (no `.env.local` / Vercel — NUNCA no código)

- `EVOLUTION_API_URL` — `http://2.25.202.44:8080`
- `EVOLUTION_API_KEY` — a apikey (secreta)
- `EVOLUTION_INSTANCE` — `gustpro`

## Como funciona no código

1. **`src/lib/whatsapp.ts`** (server-side) — `enviarWhatsApp()`, `enviarVarios()`,
   `normalizarNumero()` e `montarMensagem()` (os 7 templates de texto). Tem trava
   anti-spam de 3,5s entre envios (senão o WhatsApp bloqueia disparos em massa).
2. **`src/app/api/whatsapp/route.ts`** — rota server-side. O navegador chama ela
   (seguro, HTTPS, mesmo domínio); ela guarda a apikey e fala com a Evolution.
3. **Componentes client** — depois de salvar no Supabase, chamam `fetch('/api/whatsapp', …)`.
4. **`src/app/api/cron/lembretes/route.ts`** — lembrete D-1 (véspera), rodado por
   Vercel Cron (ver `vercel.json`).

### Endpoint de envio (Evolution v1.x)

```
POST {EVOLUTION_API_URL}/message/sendText/{instancia}
Header: apikey: <EVOLUTION_API_KEY>
Body: { "number": "5563999998888",
        "options": { "delay": 800, "presence": "composing" },
        "textMessage": { "text": "Mensagem aqui" } }
```

`number` = só dígitos, com DDI 55, sem `+`/espaços/traços. `normalizarNumero()` cuida disso.

## Os 7 fluxos (eventos que disparam mensagem)

| Fluxo | Evento no sistema | Quem recebe |
|---|---|---|
| `escalacao` | promotora adicionada à escala de um serviço | a promotora escalada |
| `lembrete` | véspera do serviço (cron diário) | promotoras confirmadas |
| `briefing` | briefing do serviço salvo | promotoras da escala |
| `confirmacao` | confirmação marcada como "confirmada" | a promotora |
| `checkin` | serviço muda para "em_andamento" | promotoras da escala |
| `relatorio` | serviço muda para "concluido" | promotoras da escala |
| `pagamento` | pagamento da escala vira "pago" | a promotora paga |

Os textos ficam em `montarMensagem()` (em `src/lib/whatsapp.ts`) — edite lá pra mudar o tom.

## Deploy (Vercel)

Configurar as 4 variáveis (`EVOLUTION_*` + `CRON_SECRET`) em
**Vercel → Project → Settings → Environment Variables** (Production). Sem isso, em
produção os envios falham com `config_ausente` (aparece no log).

## Limites e cuidados

- Não é API oficial: evitar marketing em massa pra números frios (risco de bloqueio).
- Se a sessão cair, reconectar o número pelo Manager (escanear QR de novo).
- Trava anti-spam (3,5s) protege os broadcasts; não remover.
