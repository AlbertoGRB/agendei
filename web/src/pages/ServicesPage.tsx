import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { messageOf } from '../api/client';
import {
  createService,
  listMyServices,
  updateService,
  type Service,
  type ServiceInput,
} from '../api/services';
import { Button, SecondaryButton } from '../components/Button';
import { Field } from '../components/Field';
import { FormError } from '../components/FormError';
import { Loading } from '../components/Loading';
import { SelectField } from '../components/SelectField';
import {
  formatDuration,
  formatPrice,
  parsePrice,
  priceInput,
} from '../lib/format';

// Durações aceitas: de 30 em 30 minutos, de 30 a 480 (RN01).
const DURATIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 30);

const NAME_MESSAGE = 'O nome deve ter entre 2 e 100 caracteres';

// As mesmas regras da API, para avisar antes de enviar. Quem decide é a API.
const schema = z.object({
  name: z.string().trim().min(2, NAME_MESSAGE).max(100, NAME_MESSAGE),
  duration: z.string(),
  price: z
    .string()
    .refine(
      (value) => parsePrice(value) !== null,
      'Use um preço em reais, como 50 ou 49,90',
    )
    .refine(
      (value) => (parsePrice(value) ?? 0) <= 10_000_000,
      'O preço deve ser de no máximo R$ 100.000,00',
    ),
});

// Serviços do prestador: cadastrar, editar e desativar (RF03, RF04).
export function ServicesPage() {
  const queryClient = useQueryClient();
  const services = useQuery({
    queryKey: ['services'],
    queryFn: listMyServices,
  });
  const [created, setCreated] = useState<string | null>(null);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['services'] });

  return (
    <section>
      <title>Serviços · agendei</title>
      <h1 className="text-2xl font-bold">Serviços</h1>
      <p className="mt-1 text-slate-700">
        Os clientes veem os serviços ativos e escolhem um para reservar.
      </p>

      <section aria-labelledby="seus-servicos" className="mt-6">
        <h2 id="seus-servicos" className="text-lg font-semibold">
          Seus serviços
        </h2>
        {services.isPending ? (
          <Loading />
        ) : services.isError ? (
          <div className="mt-3">
            <FormError message={messageOf(services.error)} />
          </div>
        ) : services.data.length === 0 ? (
          <p className="mt-2 text-slate-700">
            Você ainda não tem serviços. Cadastre o primeiro abaixo.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {services.data.map((service) => (
              <ServiceItem
                key={service.id}
                service={service}
                onChanged={refresh}
              />
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="novo-servico"
        className="mt-8 rounded-lg border border-slate-200 bg-white p-4"
      >
        <h2 id="novo-servico" className="text-lg font-semibold">
          Novo serviço
        </h2>
        {/* A região fica sempre na página, para o leitor de tela anunciar
            quando o texto aparece. */}
        <output className="block mt-2 text-sm text-teal-800 empty:hidden">
          {created && `${created} foi adicionado.`}
        </output>
        <ServiceForm
          submitLabel="Adicionar serviço"
          onSubmit={async (input) => {
            setCreated(null);
            await createService(input);
            await refresh();
            setCreated(input.name);
          }}
        />
      </section>
    </section>
  );
}

function ServiceItem({
  service,
  onChanged,
}: {
  service: Service;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const touched = useRef(false);

  // Desativar não apaga: o serviço some para novas reservas, e as já feitas
  // continuam valendo (RN10).
  const toggle = useMutation({
    mutationFn: () => updateService(service.id, { active: !service.active }),
    onSuccess: onChanged,
  });

  // Ao sair da edição, o foco volta para o botão "Editar".
  useEffect(() => {
    if (touched.current && !editing) {
      editButton.current?.focus();
    }
  }, [editing]);

  const stopEditing = () => {
    touched.current = true;
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="rounded-lg border border-teal-700 bg-white p-4">
        <h3 className="font-semibold">Editar {service.name}</h3>
        <ServiceForm
          initial={service}
          submitLabel="Salvar"
          focusOnOpen
          onCancel={stopEditing}
          onSubmit={async (input) => {
            await updateService(service.id, input);
            await onChanged();
            stopEditing();
          }}
        />
      </li>
    );
  }

  return (
    <li
      className={`rounded-lg border border-slate-200 p-4 ${service.active ? 'bg-white' : 'bg-slate-100'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{service.name}</h3>
          <p className="mt-0.5 text-sm text-slate-700">
            {formatDuration(service.durationMinutes)} ·{' '}
            {formatPrice(service.priceCents)}
          </p>
        </div>
        {!service.active && (
          <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
            Desativado
          </span>
        )}
      </div>
      {!service.active && (
        <p className="mt-2 text-sm text-slate-700">
          Não aparece para novas reservas. As que já foram feitas continuam
          valendo.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <SecondaryButton
          ref={editButton}
          type="button"
          onClick={() => {
            toggle.reset();
            setEditing(true);
          }}
        >
          Editar <span className="sr-only">{service.name}</span>
        </SecondaryButton>
        <SecondaryButton
          type="button"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate()}
        >
          {service.active ? 'Desativar' : 'Reativar'}{' '}
          <span className="sr-only">{service.name}</span>
        </SecondaryButton>
      </div>
      {toggle.isError && (
        <div className="mt-3">
          <FormError message={messageOf(toggle.error)} />
        </div>
      )}
    </li>
  );
}

function ServiceForm({
  initial,
  submitLabel,
  focusOnOpen = false,
  onSubmit,
  onCancel,
}: {
  initial?: Service;
  submitLabel: string;
  focusOnOpen?: boolean;
  onSubmit: (input: ServiceInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      duration: String(initial?.durationMinutes ?? 60),
      price: initial ? priceInput(initial.priceCents) : '',
    },
  });

  useEffect(() => {
    if (focusOnOpen) {
      setFocus('name');
    }
  }, [focusOnOpen, setFocus]);

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit({
        name: values.name,
        durationMinutes: Number(values.duration),
        priceCents: parsePrice(values.price) ?? 0,
      });
      if (!initial) {
        reset();
      }
    } catch (error) {
      setFormError(messageOf(error));
    }
  });

  return (
    <form noValidate onSubmit={submit} className="mt-3 flex flex-col gap-4">
      {formError && <FormError message={formError} />}
      <Field label="Nome" error={errors.name?.message} {...register('name')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Duração" {...register('duration')}>
          {DURATIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {formatDuration(minutes)}
            </option>
          ))}
        </SelectField>
        <Field
          label="Preço"
          inputMode="decimal"
          hint="Em reais, como 50 ou 49,90"
          error={errors.price?.message}
          {...register('price')}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : submitLabel}
        </Button>
        {onCancel && (
          <SecondaryButton type="button" onClick={onCancel}>
            Cancelar edição
          </SecondaryButton>
        )}
      </div>
    </form>
  );
}
