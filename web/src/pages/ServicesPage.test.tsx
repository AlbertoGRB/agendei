import { screen, waitFor, within } from '@testing-library/react';
import { setAccessToken } from '../api/client';
import type { Service } from '../api/services';
import { fakeApi, reply } from '../test/fake-api';
import { renderApp } from '../test/render-app';

const anaSession = {
  'POST /api/auth/refresh': () => reply(200, { accessToken: 'token-da-ana' }),
  'GET /api/users/me': () =>
    reply(200, {
      id: 'p1',
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      role: 'PROVIDER',
      timezone: 'America/Sao_Paulo',
    }),
};

const CORTE: Service = {
  id: 's1',
  name: 'Corte',
  durationMinutes: 60,
  priceCents: 5000,
  active: true,
};
const BARBA: Service = {
  id: 's2',
  name: 'Barba',
  durationMinutes: 30,
  priceCents: 3000,
  active: false,
};

function itemOf(name: string): HTMLElement {
  return screen.getByRole('heading', { name }).closest('li')!;
}

beforeEach(() => {
  setAccessToken(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('serviços do prestador', () => {
  it('lista os serviços, com o desativado marcado', async () => {
    fakeApi({
      ...anaSession,
      'GET /api/services': () => reply(200, [CORTE, BARBA]),
    });
    renderApp('/servicos');

    await screen.findByRole('heading', { name: 'Corte' });
    expect(itemOf('Corte')).toHaveTextContent(/1 h · R\$\s50,00/);
    expect(itemOf('Corte')).not.toHaveTextContent('Desativado');
    expect(itemOf('Barba')).toHaveTextContent('Desativado');
    expect(itemOf('Barba')).toHaveTextContent(
      'Não aparece para novas reservas.',
    );
  });

  it('cadastra um serviço com a duração da lista e o preço em reais (RF03)', async () => {
    let sent: unknown;
    let list = [CORTE];
    fakeApi({
      ...anaSession,
      'GET /api/services': () => reply(200, list),
      'POST /api/services': ({ body }) => {
        sent = body;
        const created = {
          id: 's3',
          ...(body as object),
          active: true,
        } as Service;
        list = [...list, created];
        return reply(201, created);
      },
    });
    const user = renderApp('/servicos');

    await screen.findByRole('heading', { name: 'Corte' });
    await user.type(screen.getByLabelText('Nome'), 'Corte e barba');
    await user.selectOptions(screen.getByLabelText('Duração'), '1 h 30 min');
    await user.type(screen.getByLabelText('Preço'), '79,90');
    await user.click(screen.getByRole('button', { name: 'Adicionar serviço' }));

    expect(
      await screen.findByText('Corte e barba foi adicionado.'),
    ).toBeInTheDocument();
    expect(sent).toEqual({
      name: 'Corte e barba',
      durationMinutes: 90,
      priceCents: 7990,
    });
    expect(
      screen.getByRole('heading', { name: 'Corte e barba' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('');
  });

  it('avisa o preço inválido antes de chamar a API', async () => {
    const server = fakeApi({
      ...anaSession,
      'GET /api/services': () => reply(200, []),
    });
    const user = renderApp('/servicos');

    await screen.findByText(
      'Você ainda não tem serviços. Cadastre o primeiro abaixo.',
    );
    await user.type(screen.getByLabelText('Nome'), 'Corte');
    await user.type(screen.getByLabelText('Preço'), 'R$ 50');
    await user.click(screen.getByRole('button', { name: 'Adicionar serviço' }));

    expect(screen.getByLabelText('Preço')).toHaveAccessibleDescription(
      'Em reais, como 50 ou 49,90 Use um preço em reais, como 50 ou 49,90',
    );
    expect(server.calls().join('\n')).not.toContain('POST /api/services');
  });

  it('mostra o erro que a API devolver', async () => {
    fakeApi({
      ...anaSession,
      'GET /api/services': () => reply(200, []),
      'POST /api/services': () =>
        reply(400, { message: ['O nome deve ter entre 2 e 100 caracteres'] }),
    });
    const user = renderApp('/servicos');

    await screen.findByText(
      'Você ainda não tem serviços. Cadastre o primeiro abaixo.',
    );
    await user.type(screen.getByLabelText('Nome'), 'Corte');
    await user.type(screen.getByLabelText('Preço'), '50');
    await user.click(screen.getByRole('button', { name: 'Adicionar serviço' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O nome deve ter entre 2 e 100 caracteres',
    );
  });

  it('edita um serviço e devolve o foco ao botão "Editar" (RF04)', async () => {
    let sent: unknown;
    let corte = CORTE;
    fakeApi({
      ...anaSession,
      'GET /api/services': () => reply(200, [corte, BARBA]),
      'PATCH /api/services/s1': ({ body }) => {
        sent = body;
        corte = { ...corte, ...(body as object) };
        return reply(200, corte);
      },
    });
    const user = renderApp('/servicos');

    await user.click(
      await screen.findByRole('button', { name: 'Editar Corte' }),
    );
    const editing = screen
      .getByRole('heading', { name: 'Editar Corte' })
      .closest('li')!;
    const name = within(editing).getByLabelText('Nome');
    expect(name).toHaveFocus();
    expect(name).toHaveValue('Corte');
    const price = within(editing).getByLabelText('Preço');
    expect(price).toHaveValue('50,00');
    await user.clear(price);
    await user.type(price, '55');
    await user.click(within(editing).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(itemOf('Corte')).toHaveTextContent(/R\$\s55,00/),
    );
    expect(sent).toEqual({
      name: 'Corte',
      durationMinutes: 60,
      priceCents: 5500,
    });
    expect(screen.getByRole('button', { name: 'Editar Corte' })).toHaveFocus();
  });

  it('desativa e reativa sem apagar (RN10)', async () => {
    const sent: unknown[] = [];
    fakeApi({
      ...anaSession,
      'GET /api/services': () => reply(200, [CORTE, BARBA]),
      'PATCH /api/services/s1': ({ body }) => {
        sent.push(['s1', body]);
        return reply(200, { ...CORTE, active: false });
      },
      'PATCH /api/services/s2': ({ body }) => {
        sent.push(['s2', body]);
        return reply(200, { ...BARBA, active: true });
      },
    });
    const user = renderApp('/servicos');

    await user.click(
      await screen.findByRole('button', { name: 'Desativar Corte' }),
    );
    await user.click(screen.getByRole('button', { name: 'Reativar Barba' }));

    await waitFor(() =>
      expect(sent).toEqual([
        ['s1', { active: false }],
        ['s2', { active: true }],
      ]),
    );
  });

  it('a página de serviços é só para prestador', async () => {
    const server = fakeApi({
      'POST /api/auth/refresh': () =>
        reply(200, { accessToken: 'token-da-carla' }),
      'GET /api/users/me': () =>
        reply(200, {
          id: 'c1',
          name: 'Carla Dias',
          role: 'CLIENT',
          timezone: 'America/Sao_Paulo',
        }),
      'GET /api/providers': () => reply(200, []),
    });
    renderApp('/servicos');

    expect(
      await screen.findByRole('heading', { name: 'Escolha um prestador' }),
    ).toBeInTheDocument();
    expect(server.calls().join('\n')).not.toContain('/api/services');
  });
});
