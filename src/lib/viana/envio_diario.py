#!/usr/bin/env python3
"""
envio_diario.py - Bot Viana | Viana Supermercado
Envia agenda do proximo dia para Kenia as 14:00 (horario local do servidor)
Cron: 0 14 * * * /usr/bin/python3 /opt/viana/scripts/envio_diario.py >> /opt/viana/logs/envio_diario.log 2>&1
"""
import os, json, sys
from datetime import datetime, timezone, timedelta

def load_env(path="/opt/viana/.env"):
    if not os.path.exists(path):
        print(f"ERRO: .env nao encontrado em {path}")
        sys.exit(1)
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

load_env()

try:
    import requests
except ImportError:
    print("ERRO: requests nao instalado. Rode: pip3 install requests --break-system-packages")
    sys.exit(1)

SUPABASE_URL  = os.environ.get("SUPABASE_URL_PRIME_SABOR", "")
SUPABASE_KEY  = os.environ.get("SUPABASE_SERVICE_KEY_PRIME_SABOR", "")
EVOLUTION_URL = os.environ.get("EVOLUTION_BASE_URL", "http://localhost:8080")
EVOLUTION_INST = os.environ.get("EVOLUTION_INSTANCE", "gustpro")
EVOLUTION_KEY  = os.environ.get("EVOLUTION_API_KEY", "")
KENIA         = os.environ.get("WHATSAPP_KENIA", "556392197949")

BUCKET  = "viana-agenda"
ARQUIVO = "agenda-atual.json"

STATUS_EMOJI = {
    'COTACAO':         '🟢',
    'COTAÇÃO':         '🟢',
    'PEDIDO DIGITADO': '🔵',
    'PEDIDO PENDENTE': '🟡',
    'TERMO ESTOQUE':   '🔴',
}

DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

def log(msg):
    print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {msg}", flush=True)

def carregar_agenda():
    h = {"Authorization": f"Bearer {SUPABASE_KEY}"}
    r = requests.get(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{ARQUIVO}",
        headers=h, timeout=30
    )
    if r.status_code != 200:
        log(f"ERRO ao carregar agenda do Storage: {r.status_code} - {r.text[:200]}")
        sys.exit(1)
    return r.json()

def fmt_linha(l):
    cod     = l.get('cod') or '?'
    desc    = (l.get('descricao') or '').strip() or 'Sem descricao'
    status  = (l.get('status') or '').strip()
    comprador = (l.get('comprador') or '').strip()
    emoji   = STATUS_EMOJI.get(status.upper(), '⚪')
    txt = f"{emoji} *{cod}* — {desc}"
    if status:
        txt += f"\n    status: {status}"
    if comprador:
        txt += f"\n    comprador: {comprador}"
    return txt

def formatar_mensagem(linhas, amanha):
    amanha_str = amanha.strftime('%Y-%m-%d')
    matches = [l for l in linhas if (l.get('data') or '')[:10] == amanha_str]

    dia_fmt   = amanha.strftime('%d/%m')
    dia_nome  = DIAS_SEMANA[amanha.weekday()]
    titulo    = f"AMANHÃ — {dia_nome} {dia_fmt}"

    if not matches:
        return f"📋 *{titulo}*\n\nNenhum fornecedor agendado amanhã. 🎉\n\n— Viana"

    plural = 'fornecedores' if len(matches) > 1 else 'fornecedor'
    msg  = f"📋 *{titulo}* ({len(matches)} {plural})\n\n"
    msg += '\n\n'.join(fmt_linha(l) for l in matches)
    msg += "\n\n— Viana"
    return msg

def enviar_whatsapp(numero, texto):
    url = f"{EVOLUTION_URL}/message/sendText/{EVOLUTION_INST}"
    h   = {"apikey": EVOLUTION_KEY, "Content-Type": "application/json"}
    body = {
        "number": numero,
        "options": {"delay": 1200},
        "textMessage": {"text": texto}
    }
    r = requests.post(url, json=body, headers=h, timeout=30)
    if r.status_code not in (200, 201):
        log(f"ERRO envio WhatsApp: {r.status_code} - {r.text[:200]}")
        sys.exit(1)
    log(f"mensagem enviada para ...{numero[-4:]} OK")

if __name__ == "__main__":
    log("=== envio_diario.py iniciado ===")

    agenda = carregar_agenda()
    linhas = agenda.get('linhas', [])
    log(f"agenda carregada: {len(linhas)} linhas")

    # Usa horario de Brasilia (UTC-3) para calcular "amanha"
    agora_brt = datetime.now(timezone.utc) - timedelta(hours=3)
    amanha    = agora_brt + timedelta(days=1)
    log(f"enviando agenda de amanha: {amanha.strftime('%d/%m/%Y (%A)')}")

    mensagem = formatar_mensagem(linhas, amanha)
    log(f"mensagem: {len(mensagem)} chars")

    enviar_whatsapp(KENIA, mensagem)

    log("=== concluido ===")
