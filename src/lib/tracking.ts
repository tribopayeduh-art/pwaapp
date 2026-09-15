/**
 * WhatsApp Automation Event Dispatchers
 * Notifies the backend to trigger automated WhatsApp messages (Welcome, PIX Recovery, Deposit Confirmed).
 */

export function trackRegistration(userData?: { email?: string; name?: string; phone?: string }) {
  void notifyBackendConversion('lead_created', {
    customer: userData,
  });
}

export function trackDepositInitiated(amount: number, transactionId?: string, extraData?: Record<string, any>) {
  void notifyBackendConversion('pix_generated', {
    value: amount,
    orderId: transactionId,
    pixCode: extraData?.pixCode,
    gameId: extraData?.gameId,
    customer: extraData?.customer,
    ...extraData,
  });
}

export function trackDepositSuccess(amount: number, transactionId?: string, extraData?: Record<string, any>) {
  void notifyBackendConversion('order_approved', {
    value: amount,
    orderId: transactionId,
    gameId: extraData?.gameId,
    customer: extraData?.customer,
    balance: extraData?.balance,
    ...extraData,
  });
}

async function notifyBackendConversion(eventType: string, payload: any) {
  try {
    await fetch('/api/campaigns/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: eventType,
        ...payload,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    // silent
  }
}
