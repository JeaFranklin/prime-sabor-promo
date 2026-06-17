# Setup Microsoft Graph API — OneDrive para Supabase

> **Objetivo:** substituir o rclone da VPS pelo Microsoft Graph API.
> Após isso, o PuTTY pode ser deletado.
>
> **Tempo estimado:** 20 minutos (feito 1x só)

---

## Passo 1 — Registrar app no Azure (5 min)

1. Acesse: https://portal.azure.com
2. Pesquise **"App registrations"** na barra de busca
3. Clique **"New registration"**
4. Preencha:
   - Name: `viana-onedrive`
   - Supported account types: **Accounts in this organizational directory only**
   - Redirect URI: `http://localhost:3000/callback`
5. Clique **Register**

Na tela do app criado, anote:
- **Application (client) ID** → será `VIANA_MS_CLIENT_ID`
- **Directory (tenant) ID** → será `VIANA_MS_TENANT_ID`

---

## Passo 2 — Criar Client Secret (2 min)

1. No app criado, clique **"Certificates & secrets"**
2. Clique **"New client secret"**
3. Description: `viana-supabase`
4. Expires: **24 months**
5. Clique **Add**
6. **COPIE O VALUE AGORA** (aparece só 1x) → será `VIANA_MS_CLIENT_SECRET`

---

## Passo 3 — Adicionar permissão Files.Read (2 min)

1. Clique **"API permissions"**
2. Clique **"Add a permission"** → **Microsoft Graph** → **Delegated permissions**
3. Pesquise `Files.Read` e marque **Files.Read.All**
4. Clique **Add permissions**
5. Clique **"Grant admin consent"** → Confirme

---

## Passo 4 — Obter Refresh Token (10 min)

> Precisa fazer isso 1x para autorizar o acesso ao OneDrive da conta Viana.

### 4a. Montar a URL de autorização

Substitua `SEU_CLIENT_ID` e abra no navegador:

```
https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=SEU_CLIENT_ID&response_type=code&redirect_uri=http://localhost:3000/callback&scope=Files.Read.All offline_access&response_mode=query
```

1. Faça login com a conta que tem acesso ao OneDrive da Viana
2. Autorize o app
3. Você será redirecionado para `http://localhost:3000/callback?code=CODIGO_LONGO`
4. **Copie o `code=...`** (tudo depois de `code=` até o `&` seguinte)

### 4b. Trocar o code pelo refresh_token

No PowerShell, rode (substituindo os valores):

```powershell
$body = @{
  client_id     = "SEU_CLIENT_ID"
  client_secret = "SEU_CLIENT_SECRET"
  code          = "COLE_O_CODE_AQUI"
  redirect_uri  = "http://localhost:3000/callback"
  grant_type    = "authorization_code"
  scope         = "Files.Read.All offline_access"
}
$r = Invoke-RestMethod -Uri "https://login.microsoftonline.com/common/oauth2/v2.0/token" -Method POST -Body $body
$r.refresh_token
```

O valor exibido → será `VIANA_MS_REFRESH_TOKEN`

---

## Passo 5 — Descobrir o caminho do arquivo no OneDrive (2 min)

O `VIANA_ONEDRIVE_FILE_PATH` é o caminho do Excel dentro do OneDrive.

Exemplo: se o arquivo está em `Documentos/Viana/Agenda.xlsx`, o valor é:
```
Documentos/Viana/Agenda.xlsx
```

Para confirmar, no OneDrive web (onedrive.live.com), navegue até o arquivo e veja o caminho na URL.

---

## Passo 6 — Configurar secrets no Supabase (3 min)

No PowerShell (na pasta do projeto):

```powershell
cd "C:\Users\jeafr\OneDrive\Consultoria\prime-sabor-promo"

supabase secrets set VIANA_MS_TENANT_ID="COLE_AQUI"
supabase secrets set VIANA_MS_CLIENT_ID="COLE_AQUI"
supabase secrets set VIANA_MS_CLIENT_SECRET="COLE_AQUI"
supabase secrets set VIANA_MS_REFRESH_TOKEN="COLE_AQUI"
supabase secrets set VIANA_ONEDRIVE_FILE_PATH="COLE_AQUI"

# Secrets da Evolution API (já existem no .env da VPS — copiar daqui)
supabase secrets set VIANA_EVOLUTION_URL="http://2.25.202.44:8080"
supabase secrets set VIANA_EVOLUTION_INSTANCE="gustpro"
supabase secrets set VIANA_EVOLUTION_KEY="gustpro2026"
supabase secrets set VIANA_WHATSAPP_KENIA="556392197949"
```

---

## Passo 7 — Deploy das Edge Functions (2 min)

```powershell
cd "C:\Users\jeafr\OneDrive\Consultoria\prime-sabor-promo"

supabase functions deploy viana-upload-agenda
supabase functions deploy viana-envio-manha
supabase functions deploy viana-envio-tarde
```

---

## Passo 8 — Testar as funções (5 min)

```powershell
# Testa upload da agenda (deve retornar { ok: true, linhas: XXXX })
supabase functions invoke viana-upload-agenda --no-verify-jwt

# Testa envio da manhã (vai mandar mensagem pra Kênia — avisa ela antes!)
supabase functions invoke viana-envio-manha --no-verify-jwt

# Testa envio da tarde
supabase functions invoke viana-envio-tarde --no-verify-jwt
```

---

## Passo 9 — Ativar pg_cron no Supabase (1 min)

No painel do Supabase:
1. Acesse: https://supabase.com/dashboard/project/knbcnplmuiuigfwogdfb/database/extensions
2. Ative **pg_cron** e **pg_net**
3. No SQL Editor, cole e execute o conteúdo de `supabase/migrations/007_viana_cron.sql`

---

## Passo 10 — Desativar crons da VPS (última vez no PuTTY)

Depois de confirmar que as Edge Functions estão funcionando:

```bash
# No PuTTY (última vez)
crontab -e
# Comentar ou deletar as 3 linhas do viana-*
# Salvar e sair
```

Pronto! PuTTY pode ser deletado. ✅

---

## Resumo das variáveis de ambiente

| Secret Supabase | Valor |
|---|---|
| `VIANA_MS_TENANT_ID` | Do portal Azure |
| `VIANA_MS_CLIENT_ID` | Do portal Azure |
| `VIANA_MS_CLIENT_SECRET` | Do portal Azure |
| `VIANA_MS_REFRESH_TOKEN` | Do passo 4b |
| `VIANA_ONEDRIVE_FILE_PATH` | Caminho do Excel |
| `VIANA_EVOLUTION_URL` | `http://2.25.202.44:8080` |
| `VIANA_EVOLUTION_INSTANCE` | `gustpro` |
| `VIANA_EVOLUTION_KEY` | `gustpro2026` |
| `VIANA_WHATSAPP_KENIA` | `556392197949` |
