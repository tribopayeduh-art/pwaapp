/** Bound upstream requests. A timed-out transfer must be reconciled, never blindly retried. */
export function fetchWithTimeout(input: string | URL | Request, init: RequestInit = {}): Promise<globalThis.Response> {
  const timeout = AbortSignal.timeout(15_000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return globalThis.fetch(input, { ...init, signal });
}
