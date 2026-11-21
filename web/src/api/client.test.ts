import { fakeApi, reply } from '../test/fake-api';
import { api, onSessionEnd, post, setAccessToken } from './client';

// Rota protegida: só aceita o token novo, como se o velho tivesse vencido.
const onlyNewToken = ({ token }: { token: string | null }) =>
  token === 'token-novo' ? reply(200, { id: '1' }) : reply(401);

describe('cliente da API', () => {
  beforeEach(() => {
    setAccessToken('token-velho');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('chama a API em /api, com o token de acesso no cabeçalho', async () => {
    const server = fakeApi({
      'GET /api/users/me': () => reply(200, { id: '1' }),
    });

    await expect(api('/users/me')).resolves.toEqual({ id: '1' });
    expect(server.calls()).toEqual(['GET /api/users/me token-velho']);
  });

  it('com o token vencido, renova a sessão e repete a chamada', async () => {
    const server = fakeApi({
      'POST /api/auth/refresh': () => reply(200, { accessToken: 'token-novo' }),
      'GET /api/users/me': onlyNewToken,
    });

    await expect(api('/users/me')).resolves.toEqual({ id: '1' });
    expect(server.calls()).toEqual([
      'GET /api/users/me token-velho',
      'POST /api/auth/refresh token-velho',
      'GET /api/users/me token-novo',
    ]);
  });

  it('duas chamadas com o token vencido dividem uma renovação só', async () => {
    const server = fakeApi({
      // Responde depois de um instante, para as duas chamadas se cruzarem.
      'POST /api/auth/refresh': () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve(reply(200, { accessToken: 'token-novo' })),
            10,
          ),
        ),
      'GET /api/bookings': onlyNewToken,
      'GET /api/services': onlyNewToken,
    });

    await Promise.all([api('/bookings'), api('/services')]);

    const refreshes = server.calls().filter((call) => call.includes('refresh'));
    expect(refreshes).toHaveLength(1);
  });

  it('se a renovação falha, encerra a sessão e explica o motivo', async () => {
    const ended = vi.fn();
    onSessionEnd(ended);
    fakeApi({
      'POST /api/auth/refresh': () => reply(401),
      'GET /api/users/me': onlyNewToken,
    });

    await expect(api('/users/me')).rejects.toMatchObject({
      status: 401,
      message: 'Sua sessão expirou. Entre de novo.',
    });
    expect(ended).toHaveBeenCalledOnce();
  });

  it('não tenta renovar quando o 401 é a resposta do login', async () => {
    const server = fakeApi({
      'POST /api/auth/login': () =>
        reply(401, { message: 'E-mail ou senha inválidos' }),
    });

    await expect(
      api('/auth/login', post({ email: 'ana@exemplo.com', password: 'x' })),
    ).rejects.toMatchObject({
      status: 401,
      message: 'E-mail ou senha inválidos',
    });
    expect(server.calls()).toHaveLength(1);
  });

  it('mostra a primeira mensagem da validação da API', async () => {
    fakeApi({
      'POST /api/auth/register': () =>
        reply(400, { message: ['E-mail inválido', 'Senha curta'] }),
    });

    await expect(api('/auth/register', post({}))).rejects.toThrow(
      'E-mail inválido',
    );
  });

  it('o limite de tentativas vira uma mensagem em português', async () => {
    fakeApi({
      'POST /api/auth/login': () =>
        reply(429, { message: 'ThrottlerException: Too Many Requests' }),
    });

    await expect(api('/auth/login', post({}))).rejects.toThrow(
      'Muitas tentativas seguidas. Espere um minuto e tente de novo.',
    );
  });

  it('sem conexão, explica o problema em vez do erro do navegador', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    await expect(api('/users/me')).rejects.toMatchObject({
      status: 0,
      message:
        'Sem conexão com o servidor. Confira a internet e tente de novo.',
    });
  });
});
