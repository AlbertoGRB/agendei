// Cliente HTTP do front. O token de acesso fica só em memória (ADR 0004):
// some ao recarregar a página, e a sessão volta pelo cookie de renovação.
// A API é chamada no próprio endereço do front, em /api (ADR 0006).

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let sessionEnded: () => void = () => {};

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function hasAccessToken(): boolean {
  return accessToken !== null;
}

// Chamado quando a renovação falha no meio do uso: o cookie venceu ou foi
// revogado, e a pessoa precisa entrar de novo.
export function onSessionEnd(listener: () => void): void {
  sessionEnded = listener;
}

// Troca o cookie de renovação por um token de acesso novo. Quem pede ao
// mesmo tempo espera a mesma troca: a API troca o cookie a cada uso, então
// uma segunda troca em paralelo mandaria um cookie que já não vale.
export function refreshSession(): Promise<boolean> {
  refreshing ??= send('/auth/refresh', { method: 'POST' })
    .then(async (response) => {
      if (!response.ok) {
        accessToken = null;
        return false;
      }
      const body = (await response.json()) as { accessToken: string };
      accessToken = body.accessToken;
      return true;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await send(path, init);

  // Token de acesso vencido: renova uma vez e repete a chamada. Nas rotas de
  // sessão o 401 é a resposta em si, como a senha errada no login.
  if (response.status === 401 && !path.startsWith('/auth/')) {
    if (!(await refreshSession())) {
      sessionEnded();
      throw new ApiError(401, 'Sua sessão expirou. Entre de novo.');
    }
    response = await send(path, init);
  }

  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function post(body?: unknown): RequestInit {
  return {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Não foi possível concluir. Tente de novo.';
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  try {
    return await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      0,
      'Sem conexão com o servidor. Confira a internet e tente de novo.',
    );
  }
}

// A API responde { message } com um texto ou, na validação, com uma lista.
async function errorMessage(response: Response): Promise<string> {
  if (response.status === 429) {
    return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  }
  if (response.status >= 500) {
    return 'Algo deu errado do nosso lado. Tente de novo em instantes.';
  }
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
  } | null;
  const message = Array.isArray(body?.message)
    ? body.message[0]
    : body?.message;
  return typeof message === 'string'
    ? message
    : 'Não foi possível concluir. Tente de novo.';
}
