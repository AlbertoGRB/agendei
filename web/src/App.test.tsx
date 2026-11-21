import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { setAccessToken } from './api/client';
import { App } from './App';
import { fakeApi, reply } from './test/fake-api';

const ANA = {
  id: 'u1',
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
  role: 'PROVIDER',
  timezone: 'America/Sao_Paulo',
};

// Sem cookie de renovação válido: ninguém entrou.
const noSession = { 'POST /api/auth/refresh': () => reply(401) };

// Cookie válido: a sessão volta ao abrir a página.
const anaSession = {
  'POST /api/auth/refresh': () => reply(200, { accessToken: 'token-da-ana' }),
  'GET /api/users/me': () => reply(200, ANA),
};

function renderApp(path: string): UserEvent {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  setAccessToken(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sessão', () => {
  it('sem sessão, a página inicial leva para a tela de entrar', async () => {
    fakeApi(noSession);
    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Entrar' }),
    ).toBeInTheDocument();
  });

  it('recarregar a página mantém a sessão, pelo cookie de renovação', async () => {
    fakeApi(anaSession);
    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Olá, Ana' }),
    ).toBeInTheDocument();
  });

  it('entrar abre a sessão e leva para o início', async () => {
    const server = fakeApi({
      ...noSession,
      'POST /api/auth/login': () => reply(200, { accessToken: 'token-da-ana' }),
      'GET /api/users/me': () => reply(200, ANA),
    });
    const user = renderApp('/entrar');

    await user.type(await screen.findByLabelText('E-mail'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'senha-forte-123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByRole('heading', { name: 'Olá, Ana' }),
    ).toBeInTheDocument();
    expect(server.calls()).toContain('GET /api/users/me token-da-ana');
  });

  it('entrar com a senha errada mostra a mensagem da API', async () => {
    fakeApi({
      ...noSession,
      'POST /api/auth/login': () =>
        reply(401, { message: 'E-mail ou senha inválidos' }),
    });
    const user = renderApp('/entrar');

    await user.type(await screen.findByLabelText('E-mail'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'senha-errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-mail ou senha inválidos',
    );
  });

  it('sair encerra a sessão na API e volta para a tela de entrar', async () => {
    const server = fakeApi({
      ...anaSession,
      'POST /api/auth/logout': () => reply(204),
    });
    const user = renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(
      await screen.findByRole('heading', { name: 'Entrar' }),
    ).toBeInTheDocument();
    expect(server.calls()).toContain('POST /api/auth/logout token-da-ana');
  });
});

describe('cadastro', () => {
  async function fillAndSubmit(user: UserEvent) {
    await user.type(await screen.findByLabelText('Nome'), 'Ana Souza');
    await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'senha-forte-123');
    await user.click(screen.getByRole('radio', { name: /Prestador/ }));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
  }

  it('cria a conta, entra e leva para o início', async () => {
    let sent: unknown;
    fakeApi({
      ...noSession,
      'POST /api/auth/register': ({ body }) => {
        sent = body;
        return reply(201, ANA);
      },
      'POST /api/auth/login': () => reply(200, { accessToken: 'token-da-ana' }),
      'GET /api/users/me': () => reply(200, ANA),
    });
    const user = renderApp('/cadastro');

    await fillAndSubmit(user);

    expect(
      await screen.findByRole('heading', { name: 'Olá, Ana' }),
    ).toBeInTheDocument();
    expect(sent).toEqual({
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      password: 'senha-forte-123',
      role: 'PROVIDER',
    });
  });

  it('com o e-mail em uso, mostra "E-mail já cadastrado" no campo e não entra', async () => {
    const server = fakeApi({
      ...noSession,
      'POST /api/auth/register': () =>
        reply(409, { message: 'E-mail já cadastrado' }),
    });
    const user = renderApp('/cadastro');

    await fillAndSubmit(user);

    await screen.findByText('E-mail já cadastrado');
    expect(screen.getByLabelText('E-mail')).toHaveAccessibleDescription(
      'E-mail já cadastrado',
    );
    expect(
      screen.getByRole('heading', { name: 'Criar conta' }),
    ).toBeInTheDocument();
    expect(server.calls().some((call) => call.includes('login'))).toBe(false);
  });

  it('avisa os campos inválidos antes de chamar a API', async () => {
    const server = fakeApi(noSession);
    const user = renderApp('/cadastro');

    await user.click(
      await screen.findByRole('button', { name: 'Criar conta' }),
    );

    expect(
      await screen.findByText('O nome deve ter entre 2 e 100 caracteres'),
    ).toBeInTheDocument();
    expect(screen.getByText('E-mail inválido')).toBeInTheDocument();
    expect(
      screen.getByText('A senha deve ter pelo menos 8 caracteres'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Escolha como você vai usar o agendei'),
    ).toBeInTheDocument();
    expect(server.calls()).toEqual(['POST /api/auth/refresh -']);
  });
});
