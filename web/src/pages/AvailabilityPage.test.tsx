import { screen, within } from '@testing-library/react';
import type { AvailabilityWindow } from '../api/availability';
import { setAccessToken } from '../api/client';
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

const saved = (windows: AvailabilityWindow[]) => () => reply(200, { windows });

function day(name: string): HTMLElement {
  return screen.getByRole('group', { name });
}

// Ordena para comparar a semana sem depender da ordem de envio.
function sorted(windows: AvailabilityWindow[]): AvailabilityWindow[] {
  return [...windows].sort(
    (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime),
  );
}

beforeEach(() => {
  setAccessToken(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('horários de atendimento', () => {
  it('mostra a semana salva, de segunda a domingo', async () => {
    fakeApi({
      ...anaSession,
      'GET /api/availability': saved([
        { weekday: 1, startTime: '09:00', endTime: '12:00' },
        { weekday: 1, startTime: '14:00', endTime: '18:00' },
        { weekday: 6, startTime: '09:00', endTime: '13:00' },
      ]),
    });
    renderApp('/horarios');

    await screen.findByRole('group', { name: 'Segunda-feira' });
    const legends = screen
      .getAllByRole('group')
      .map((g) => g.querySelector('legend')?.textContent);
    expect(legends).toEqual([
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
      'Domingo',
    ]);
    const monday = within(day('Segunda-feira'));
    expect(
      monday.getByRole('combobox', { name: 'Início do 2º horário' }),
    ).toHaveValue('14:00');
    expect(
      monday.getByRole('combobox', { name: 'Fim do 2º horário' }),
    ).toHaveValue('18:00');
    expect(day('Domingo')).toHaveTextContent('Sem atendimento.');
    expect(screen.getByText(/Horário Padrão de Brasília/)).toBeInTheDocument();
  });

  it('monta segunda a sexta, das 9h às 12h e das 14h às 18h, e salva a semana inteira (US03)', async () => {
    let sent: AvailabilityWindow[] = [];
    fakeApi({
      ...anaSession,
      'GET /api/availability': saved([]),
      'PUT /api/availability': ({ body }) => {
        sent = (body as { windows: AvailabilityWindow[] }).windows;
        return reply(200, { windows: sent });
      },
    });
    const user = renderApp('/horarios');

    await user.click(
      await screen.findByRole('button', {
        name: 'Adicionar horário na segunda-feira',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Adicionar horário na segunda-feira',
      }),
    );
    const monday = within(day('Segunda-feira'));
    // O segundo horário começa onde o primeiro termina.
    expect(
      monday.getByRole('combobox', { name: 'Início do 2º horário' }),
    ).toHaveValue('12:00');
    await user.selectOptions(
      monday.getByRole('combobox', { name: 'Início do 2º horário' }),
      '14:00',
    );
    await user.selectOptions(
      monday.getByRole('combobox', { name: 'Fim do 2º horário' }),
      '18:00',
    );
    await user.click(
      screen.getByRole('button', { name: 'Repetir de terça a sexta' }),
    );
    await user.click(screen.getByRole('button', { name: 'Salvar horários' }));

    expect(await screen.findByText('Horários salvos.')).toBeInTheDocument();
    const expected = [1, 2, 3, 4, 5].flatMap((weekday) => [
      { weekday, startTime: '09:00', endTime: '12:00' },
      { weekday, startTime: '14:00', endTime: '18:00' },
    ]);
    expect(sorted(sent)).toEqual(expected);
    expect(day('Sábado')).toHaveTextContent('Sem atendimento.');
  });

  it('horários sobrepostos no mesmo dia: avisa e não chama a API (RN03)', async () => {
    const server = fakeApi({
      ...anaSession,
      'GET /api/availability': saved([
        { weekday: 1, startTime: '09:00', endTime: '12:00' },
      ]),
    });
    const user = renderApp('/horarios');

    await user.click(
      await screen.findByRole('button', {
        name: 'Adicionar horário na segunda-feira',
      }),
    );
    await user.selectOptions(
      within(day('Segunda-feira')).getByRole('combobox', {
        name: 'Início do 2º horário',
      }),
      '11:00',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar horários' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Na segunda-feira, os horários 09:00–12:00 e 11:00–14:00 se sobrepõem.',
    );
    expect(server.calls().join('\n')).not.toContain('PUT');
  });

  it('fim antes do início: avisa e não chama a API (RN03)', async () => {
    const server = fakeApi({
      ...anaSession,
      'GET /api/availability': saved([
        { weekday: 6, startTime: '09:00', endTime: '12:00' },
      ]),
    });
    const user = renderApp('/horarios');

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Fim do 1º horário' }),
      '08:00',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar horários' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No sábado, o horário das 09:00 às 08:00 termina antes de começar.',
    );
    expect(server.calls().join('\n')).not.toContain('PUT');
  });

  it('remover um horário tira ele do que é salvo', async () => {
    let sent: AvailabilityWindow[] = [];
    fakeApi({
      ...anaSession,
      'GET /api/availability': saved([
        { weekday: 2, startTime: '09:00', endTime: '12:00' },
        { weekday: 2, startTime: '14:00', endTime: '18:00' },
      ]),
      'PUT /api/availability': ({ body }) => {
        sent = (body as { windows: AvailabilityWindow[] }).windows;
        return reply(200, { windows: sent });
      },
    });
    const user = renderApp('/horarios');

    await user.click(
      await screen.findByRole('button', {
        name: 'Remover o 1º horário na terça-feira',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Salvar horários' }));

    await screen.findByText('Horários salvos.');
    expect(sent).toEqual([
      { weekday: 2, startTime: '14:00', endTime: '18:00' },
    ]);
  });

  it('mostra o erro que a API devolver', async () => {
    fakeApi({
      ...anaSession,
      'GET /api/availability': saved([]),
      'PUT /api/availability': () =>
        reply(400, { message: 'Janelas demais na semana' }),
    });
    const user = renderApp('/horarios');

    await user.click(
      await screen.findByRole('button', {
        name: 'Adicionar horário no domingo',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Salvar horários' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Janelas demais na semana',
    );
    expect(screen.queryByText('Horários salvos.')).not.toBeInTheDocument();
  });

  it('a página de horários é só para prestador', async () => {
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
    renderApp('/horarios');

    expect(
      await screen.findByRole('heading', { name: 'Escolha um prestador' }),
    ).toBeInTheDocument();
    expect(server.calls().join('\n')).not.toContain('/api/availability');
  });
});
