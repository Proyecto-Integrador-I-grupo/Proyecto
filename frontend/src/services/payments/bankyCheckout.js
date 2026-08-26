export const BANKY_CHANNEL = 'bankyfinanzas:checkout';

export function describirResultadoBanco(result = {}) {
  const status = String(result.status || '').toLowerCase();
  if (status === 'completed') return 'Pago aprobado correctamente.';
  if (status === 'cancelled') return 'La ventana de pago se cerró antes de completar la operación.';
  const code = String(result.rejectionCode || '').toUpperCase();
  const messages = {
    INSUFFICIENT_FUNDS: 'La tarjeta no tiene fondos suficientes.',
    CARD_EXPIRED: 'La tarjeta está vencida.',
    CARD_DECLINED: 'El pago fue rechazado por el banco.',
    INVALID_CARD: 'La tarjeta no es válida para este pago.',
    NETWORK_ERROR: 'No se pudo contactar al banco emisor.'
  };
  return messages[code] || 'El pago no pudo completarse.';
}

export function pagarConBanky({ checkoutUrl, expectedOrigin, channel = BANKY_CHANNEL, popup: popupPreabierto = null }) {
  if (!checkoutUrl) return Promise.reject(new Error('No se recibió la dirección del servicio de pago.'));
  if (!expectedOrigin) return Promise.reject(new Error('No se configuró el origen seguro del servicio de pago.'));

  return new Promise((resolve, reject) => {
    let settled = false;
    let popup = popupPreabierto || null;
    let watcher = null;

    function cleanup() {
      window.removeEventListener('message', onMessage);
      if (watcher) window.clearInterval(watcher);
    }

    function finish(result) {
      if (settled) return;
      settled = true;
      cleanup();
      try { popup?.close(); } catch {}
      try { window.focus(); } catch {}
      resolve(result);
    }

    function onMessage(event) {
      if (event.origin !== expectedOrigin) return;
      const data = event.data || {};
      if (data.channel !== channel) return;
      const result = data.result;
      if (!result || typeof result !== 'object') return;
      const status = String(result.status || '').toLowerCase();
      if (!['completed', 'rejected', 'cancelled'].includes(status)) return;
      finish(result);
    }

    window.addEventListener('message', onMessage);
    if (!popup) {
      popup = window.open('about:blank', 'educontrolBankCheckout', 'width=620,height=820,resizable=yes,scrollbars=yes');
    }
    if (!popup) {
      cleanup();
      reject(new Error('El navegador bloqueó la ventana de pago. Permite ventanas emergentes e inténtalo nuevamente.'));
      return;
    }
    try {
      // assign() resulta más compatible con ventanas preabiertas que replace()
      // en Edge/Chrome cuando el destino pertenece a otro origen.
      popup.location.assign(checkoutUrl);
      popup.focus();
    } catch {
      cleanup();
      try {
        popup.document.body.innerHTML = '<main style=\"font-family:system-ui;padding:32px;color:#8b1e2d\"><h2>No se pudo abrir el datáfono</h2><p>Revisa la afiliación bancaria y vuelve a intentarlo.</p></main>';
      } catch {}
      reject(new Error('No se pudo abrir el datáfono del servicio bancario.'));
      return;
    }

    watcher = window.setInterval(() => {
      if (!popup || popup.closed) finish({ status: 'cancelled' });
    }, 500);
  });
}
