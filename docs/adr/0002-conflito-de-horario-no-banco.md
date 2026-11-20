# ADR 0002: Conflito de horário resolvido no banco

- **Situação:** aceita
- **Data:** 2026-11-19

## Contexto

Duas requisições podem conferir o mesmo horário ao mesmo tempo, ver que está livre e gravar as duas. Checar no código antes de gravar não impede isso. O sistema precisa garantir que um prestador nunca tenha duas reservas confirmadas que se sobreponham (RN07, RNF02).

## Decisão

Colocar a regra no PostgreSQL, com uma constraint de exclusão (uma restrição que o banco aplica a cada gravação, comparando a linha nova com as existentes) sobre o intervalo da reserva, usando `tstzrange` (intervalo de datas com fuso) e a extensão `btree_gist`:

```sql
ALTER TABLE booking ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    provider_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status = 'CONFIRMED');
```

- Se duas reservas sobrepostas chegam juntas, o banco aceita uma e recusa a outra com o erro `23P01`. A API converte esse erro em `409 Conflict`, com a mensagem "esse horário acabou de ser reservado".
- Só reservas `CONFIRMED` entram na regra, então cancelar libera o horário.
- A constraint não existe no schema do Prisma e entra numa migração SQL editada à mão.
- A função de horários livres continua existindo, mas só para mostrar opções ao cliente. Quem garante a regra é o banco.
- Um teste de concorrência dispara reservas simultâneas para o mesmo horário e confere que só uma volta `201`.

## Alternativas consideradas

- **Só checar no código:** simples, mas tem a corrida descrita no contexto; duas requisições simultâneas passam pela checagem.
- **Lock pessimista com `SELECT ... FOR UPDATE`:** funciona, mas exige lembrar de travar em todo caminho de gravação, e não há linha para travar quando o horário ainda está livre. A regra fica no código, e não no dado.
- **Grade de horários fixa com `unique`:** cada horário vira uma linha única (prestador e início). É simples, mas só funciona com serviços de duração igual ao passo da grade; serviços de 60 minutos exigiriam gravar várias linhas por reserva.

## Consequências

- Positivas: a regra vale mesmo que o código tenha um bug ou outra rota grave reservas; não há corrida; o teste de concorrência vira prova da garantia.
- Negativas: depende de recursos específicos do PostgreSQL (a extensão `btree_gist`), o que prende o projeto a esse banco; a migração é escrita à mão e precisa ser mantida junto com o schema do Prisma; a API precisa traduzir o erro `23P01`.
