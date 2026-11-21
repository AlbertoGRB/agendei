import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { ApiError, messageOf } from '../api/client';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { FormError } from '../components/FormError';
import { useSession } from '../hooks/useSession';

// As mesmas regras da API, para avisar antes de enviar. Quem decide é a API.
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome deve ter entre 2 e 100 caracteres')
    .max(100, 'O nome deve ter entre 2 e 100 caracteres'),
  email: z.string().trim().pipe(z.email('E-mail inválido')),
  // O bcrypt só usa os primeiros 72 bytes, e letra com acento vale 2.
  password: z
    .string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres')
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      'A senha é longa demais',
    ),
  role: z.enum(['CLIENT', 'PROVIDER'], {
    error: 'Escolha como você vai usar o agendei',
  }),
});

const ROLES = [
  { value: 'CLIENT', title: 'Cliente', description: 'Quero agendar horários' },
  {
    value: 'PROVIDER',
    title: 'Prestador',
    description: 'Ofereço serviços e recebo reservas',
  },
] as const;

export function RegisterPage() {
  const { signUp } = useSession();
  const roleErrorId = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (account) => {
    setFormError(null);
    try {
      await signUp(account);
    } catch (error) {
      // E-mail em uso: a mensagem fica junto do campo que precisa mudar.
      if (error instanceof ApiError && error.status === 409) {
        setError('email', { message: error.message });
      } else {
        setFormError(messageOf(error));
      }
    }
  });

  return (
    <section className="mx-auto max-w-sm">
      <title>Criar conta · agendei</title>
      <h1 className="text-2xl font-bold">Criar conta</h1>
      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        {formError && <FormError message={formError} />}
        <Field
          label="Nome"
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Field
          label="Senha"
          type="password"
          autoComplete="new-password"
          hint="Pelo menos 8 caracteres."
          error={errors.password?.message}
          {...register('password')}
        />
        <fieldset
          aria-describedby={errors.role ? roleErrorId : undefined}
          className="space-y-2"
        >
          <legend className="mb-1 text-sm font-medium">
            Como você vai usar o agendei?
          </legend>
          {ROLES.map((role) => (
            <label
              key={role.value}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-300 bg-white p-3 has-checked:border-teal-700 has-checked:bg-teal-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-teal-700"
            >
              <input
                type="radio"
                value={role.value}
                className="mt-1 accent-teal-700"
                {...register('role')}
              />
              <span>
                <span className="block font-medium">{role.title}</span>
                <span className="block text-sm text-slate-600">
                  {role.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        {errors.role && (
          <p id={roleErrorId} className="-mt-2 text-sm text-red-700">
            {errors.role.message}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Criando a conta…' : 'Criar conta'}
        </Button>
      </form>
      <p className="mt-6 text-sm">
        Já tem conta?{' '}
        <Link to="/entrar" className="font-semibold text-teal-800 underline">
          Entrar
        </Link>
      </p>
    </section>
  );
}
