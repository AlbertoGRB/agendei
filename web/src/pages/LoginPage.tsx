import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { messageOf } from '../api/client';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { FormError } from '../components/FormError';
import { useSession } from '../hooks/useSession';

const schema = z.object({
  email: z.string().trim().pipe(z.email('E-mail inválido')),
  password: z.string().min(1, 'Informe a senha'),
});

export function LoginPage() {
  const { signIn } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await signIn(email, password);
    } catch (error) {
      setFormError(messageOf(error));
    }
  });

  return (
    <section className="mx-auto max-w-sm">
      <title>Entrar · agendei</title>
      <h1 className="text-2xl font-bold">Entrar</h1>
      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        {formError && <FormError message={formError} />}
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <p className="mt-6 text-sm">
        Ainda não tem conta?{' '}
        <Link to="/cadastro" className="font-semibold text-teal-800 underline">
          Criar conta
        </Link>
      </p>
    </section>
  );
}
