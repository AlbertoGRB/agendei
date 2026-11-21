import { useId, type ComponentPropsWithRef } from 'react';

type SelectFieldProps = ComponentPropsWithRef<'select'> & {
  label: string;
  error?: string;
};

// Como o Field, com uma lista de opções no lugar do texto.
export function SelectField({
  label,
  error,
  children,
  ...select
}: SelectFieldProps) {
  const id = useId();
  const errorId = `${id}-erro`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="rounded-md border border-slate-400 bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 aria-invalid:border-red-700"
        {...select}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
