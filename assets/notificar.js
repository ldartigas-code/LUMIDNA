// Avisos por e-mail (script do Google Apps Script). Deixe NOTIFY_URL vazio para desligar.
// Para ligar: publique o script (aviso_por_email.gs) como "Aplicativo da Web" e cole o endereço gerado aqui.
const NOTIFY_URL = "";
const NOTIFY_CHAVE = "137c869c62f79f56a9";

// Aviso de um pedido: o e-mail é montado pelo script a partir dos dados do servidor, nunca do que a página manda.
// evento: "novo" (pedido recebido), "liberado" (pagamento liberado), "pago" (pagamento confirmado)
function avisarEvento(evento, id, token) {
  if (!NOTIFY_URL || !id || !token) return;
  try {
    fetch(NOTIFY_URL, {
      method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ chave: NOTIFY_CHAVE, evento: evento, id: id, token: token })
    }).catch(function () {});
  } catch (e) {}
}
