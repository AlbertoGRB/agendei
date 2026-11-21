import type { ReactNode } from 'react';

type ChoiceProps = {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
};

// Opção de um grupo de escolha única. Por baixo é um radio de verdade, então
// as setas do teclado andam entre as opções e o leitor de tela anuncia qual
// está marcada (RNF06). O radio fica invisível, e o cartão mostra o estado.
export function Choice({
  name,
  value,
  checked,
  onChange,
  children,
}: ChoiceProps) {
  return (
    <label className="block cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 hover:border-teal-700 has-checked:border-teal-700 has-checked:bg-teal-700 has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-teal-700">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      {children}
    </label>
  );
}
