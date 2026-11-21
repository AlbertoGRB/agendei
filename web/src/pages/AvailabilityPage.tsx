import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  getAvailability,
  saveAvailability,
  type AvailabilityWindow,
} from '../api/availability';
import { messageOf } from '../api/client';
import { Button, SecondaryButton } from '../components/Button';
import { FormError } from '../components/FormError';
import { Loading } from '../components/Loading';
import { useSession } from '../hooks/useSession';
import { timeZoneName } from '../lib/format';

const DAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

// A semana começa na segunda, como na agenda de quem atende.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

// Horas cheias e meias, de 00:00 a 23:30: os horários de início saem de 30
// em 30 minutos (RN04).
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const hour = String(Math.floor(i / 2)).padStart(2, '0');
  return `${hour}:${i % 2 === 0 ? '00' : '30'}`;
});

type Row = AvailabilityWindow & { key: number };

// Chave de cada linha na tela. A API não dá id às janelas.
let lastKey = 0;
const newKey = () => ++lastKey;

function capitalized(day: number): string {
  return DAYS[day][0].toUpperCase() + DAYS[day].slice(1);
}

// "na segunda-feira", "no sábado".
function onDay(day: number): string {
  return `${day === 0 || day === 6 ? 'no' : 'na'} ${DAYS[day]}`;
}

// `steps` meias horas depois de `time`, sem passar de 23:30.
function later(time: string, steps: number): string {
  return TIMES[Math.min(TIMES.indexOf(time) + steps, TIMES.length - 1)];
}

// As mesmas regras da API (RN03): início antes do fim e nenhuma janela
// sobreposta no mesmo dia. Encostar (09:00 a 12:00 e 12:00 a 14:00) pode.
export function findProblem(windows: AvailabilityWindow[]): string | null {
  for (const w of windows) {
    if (w.startTime >= w.endTime) {
      const text = `${onDay(w.weekday)}, o horário das ${w.startTime} às ${w.endTime} termina antes de começar.`;
      return text[0].toUpperCase() + text.slice(1);
    }
  }
  const sorted = [...windows].sort(
    (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime),
  );
  for (let i = 1; i < sorted.length; i++) {
    const [previous, current] = [sorted[i - 1], sorted[i]];
    if (
      current.weekday === previous.weekday &&
      current.startTime < previous.endTime
    ) {
      const text = `${onDay(current.weekday)}, os horários ${previous.startTime}–${previous.endTime} e ${current.startTime}–${current.endTime} se sobrepõem.`;
      return text[0].toUpperCase() + text.slice(1);
    }
  }
  return null;
}

// Horários de atendimento da semana (RF05). Salvar substitui a semana toda.
export function AvailabilityPage() {
  const { user } = useSession();
  const availability = useQuery({
    queryKey: ['availability'],
    queryFn: getAvailability,
  });
  if (!user) {
    return null;
  }

  return (
    <section>
      <title>Horários · agendei</title>
      <h1 className="text-2xl font-bold">Horários de atendimento</h1>
      <p className="mt-1 text-slate-700">
        Os clientes só veem horários livres dentro destes períodos. Os horários
        valem no {timeZoneName(user.timezone)}.
      </p>
      <div className="mt-6">
        {availability.isPending ? (
          <Loading />
        ) : availability.isError ? (
          <FormError message={messageOf(availability.error)} />
        ) : (
          <WeekEditor initial={availability.data} />
        )}
      </div>
    </section>
  );
}

function WeekEditor({ initial }: { initial: AvailabilityWindow[] }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((w) => ({ ...w, key: newKey() })),
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: saveAvailability,
    onSuccess: (windows) => {
      setSaved(true);
      queryClient.setQueryData(['availability'], windows);
      // Os horários livres dos clientes mudam junto.
      void queryClient.invalidateQueries({ queryKey: ['slots'] });
    },
  });

  // Qualquer mudança apaga o aviso de salvo e o erro da última tentativa.
  const change = (update: (rows: Row[]) => Row[]) => {
    setRows(update);
    setSaved(false);
    setProblem(null);
    save.reset();
  };

  const add = (weekday: number) =>
    change((current) => {
      const last = current.filter((r) => r.weekday === weekday).at(-1);
      const startTime = last ? last.endTime : '09:00';
      const endTime = last ? later(last.endTime, 4) : '12:00';
      return [...current, { key: newKey(), weekday, startTime, endTime }];
    });

  const update = (key: number, field: 'startTime' | 'endTime', value: string) =>
    change((current) =>
      current.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );

  const remove = (key: number) =>
    change((current) => current.filter((r) => r.key !== key));

  // Copia a segunda para terça, quarta, quinta e sexta.
  const repeatMonday = () =>
    change((current) => {
      const monday = current.filter((r) => r.weekday === 1);
      const others = current.filter((r) => r.weekday < 2 || r.weekday > 5);
      const copies = [2, 3, 4, 5].flatMap((weekday) =>
        monday.map((r) => ({ ...r, key: newKey(), weekday })),
      );
      return [...others, ...copies];
    });

  const submit = () => {
    const windows = rows.map(({ weekday, startTime, endTime }) => ({
      weekday,
      startTime,
      endTime,
    }));
    const found = findProblem(windows);
    if (found) {
      setProblem(found);
      return;
    }
    save.mutate(windows);
  };

  return (
    <div className="flex flex-col gap-3">
      {ORDER.map((weekday) => {
        const day = rows.filter((r) => r.weekday === weekday);
        return (
          <fieldset
            key={weekday}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <legend className="float-left w-full font-semibold">
              {capitalized(weekday)}
            </legend>
            <div className="clear-left flex flex-col gap-2 pt-2">
              {day.length === 0 && (
                <p className="text-sm text-slate-600">Sem atendimento.</p>
              )}
              {day.map((row, i) => (
                <div
                  key={row.key}
                  className="flex flex-wrap items-center gap-2"
                >
                  <TimeSelect
                    label={`Início do ${i + 1}º horário`}
                    value={row.startTime}
                    onChange={(value) => update(row.key, 'startTime', value)}
                  />
                  <span aria-hidden="true">às</span>
                  <TimeSelect
                    label={`Fim do ${i + 1}º horário`}
                    value={row.endTime}
                    onChange={(value) => update(row.key, 'endTime', value)}
                  />
                  <SecondaryButton
                    type="button"
                    onClick={() => remove(row.key)}
                  >
                    Remover{' '}
                    <span className="sr-only">
                      o {i + 1}º horário {onDay(weekday)}
                    </span>
                  </SecondaryButton>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                <SecondaryButton type="button" onClick={() => add(weekday)}>
                  Adicionar horário{' '}
                  <span className="sr-only">{onDay(weekday)}</span>
                </SecondaryButton>
                {weekday === 1 && day.length > 0 && (
                  <SecondaryButton type="button" onClick={repeatMonday}>
                    Repetir de terça a sexta
                  </SecondaryButton>
                )}
              </div>
            </div>
          </fieldset>
        );
      })}

      {problem && <FormError message={problem} />}
      {save.isError && <FormError message={messageOf(save.error)} />}
      <output className="block text-sm text-teal-800 empty:hidden">
        {saved && 'Horários salvos.'}
      </output>
      <div>
        <Button type="button" disabled={save.isPending} onClick={submit}>
          {save.isPending ? 'Salvando…' : 'Salvar horários'}
        </Button>
      </div>
    </div>
  );
}

function TimeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-md border border-slate-400 bg-white px-2 py-1.5 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
    >
      {TIMES.map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </select>
  );
}
