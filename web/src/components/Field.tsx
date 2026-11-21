import { useId, type ComponentPropsWithRef } from 'react';

type FieldProps = ComponentPropsWithRef<'input'> & {
  label: string;
  hint?: string;
  error?: string;
};

// Campo de formulário com rótulo, dica e erro ligados ao input, para o leitor
// de tela anunciar tudo junto.
export function Field({ label, hint, error, ...input }: FieldProps) {
  const id = useId();
  const hintId = `${id}-dica`;
  const errorId = `${id}-erro`;
  const describedBy =
    [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="rounded-md border border-slate-400 bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 aria-invalid:border-red-700"
        {...input}
      />
      {hint && (
        <p id={hintId} className="text-sm text-slate-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
