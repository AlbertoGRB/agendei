// API de mentira para os testes: cada rota responde o que o teste definir.
// Rota que o teste não definiu falha, para nenhuma chamada passar escondida.

type FakeRequest = { body: unknown; token: string | null };
type Handler = (request: FakeRequest) => Response | Promise<Response>;

export function reply(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function fakeApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const route = `${init?.method ?? 'GET'} ${url}`;
    const handler = routes[route];
    if (!handler) {
      throw new Error(`Chamada não esperada no teste: ${route}`);
    }
    return handler({
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      token: tokenOf(init),
    });
  });
  vi.stubGlobal('fetch', fetchMock);

  return {
    // Cada chamada como "MÉTODO /caminho token", na ordem em que aconteceu.
    calls: () =>
      fetchMock.mock.calls.map(
        ([url, init]) =>
          `${init?.method ?? 'GET'} ${url} ${tokenOf(init) ?? '-'}`,
      ),
  };
}

function tokenOf(init?: RequestInit): string | null {
  const auth = new Headers(init?.headers).get('Authorization');
  return auth?.replace('Bearer ', '') ?? null;
}
