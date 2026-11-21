import type { ComponentPropsWithRef } from 'react';

export function Button({
  className = '',
  ...props
}: ComponentPropsWithRef<'button'>) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}

// Ação secundária: borda, fundo branco e texto menor.
export function SecondaryButton({
  className = '',
  ...props
}: ComponentPropsWithRef<'button'>) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}
