# ADR 0005: Datas em UTC, com o fuso do prestador

- **Situação:** aceita
- **Data:** 2026-11-19

## Contexto

O prestador define a disponibilidade em horário local ("das 9h às 12h"), e o cliente escolhe um dia. Esse "dia" e essas janelas só têm sentido no fuso do prestador. Já o banco precisa de instantes sem ambiguidade para comparar e ordenar reservas, e a constraint de exclusão trabalha com `tstzrange` ([ADR 0002](0002-conflito-de-horario-no-banco.md)).

## Decisão

- Reservas (`startsAt`, `endsAt`) são gravadas como `timestamptz`, em UTC.
- `Availability.startTime` e `endTime` são horas locais do prestador (`HH:mm`), por dia da semana.
- `User.timezone` guarda o fuso do prestador, com padrão `America/Sao_Paulo`.
- A API usa date-fns com fuso para converter só na borda: a data `YYYY-MM-DD` recebida em `slots` e `agenda` é interpretada no fuso do prestador, e as janelas viram instantes UTC antes de rodar a função de horários livres.
- As respostas trazem os horários em UTC (ISO 8601). O front os mostra em `America/Sao_Paulo`, o fuso do MVP.
- A função pura de horários livres recebe e devolve instantes e não usa o relógio do sistema: a hora atual entra como parâmetro, para o teste ser determinístico.

## Alternativas consideradas

- **Gravar horário local sem fuso (`timestamp`):** simples de ler, mas ambíguo, e a comparação entre prestadores de fusos diferentes e em viradas de horário de verão fica errada.
- **Fuso fixo em `America/Sao_Paulo` no código:** funciona no MVP, mas espalha a suposição pelo código e impede atender outro fuso sem refatorar.
- **Fuso do cliente:** o dia e as janelas pertencem ao local de atendimento, não a quem reserva; usar o fuso do cliente faria o mesmo horário mudar de dia conforme quem olha.

## Consequências

- Positivas: comparação e ordenação corretas no banco; a constraint de exclusão funciona direto; trocar o fuso do prestador não exige mexer nas reservas já gravadas.
- Negativas: toda conversão precisa passar pela borda da API, e um deslize gera um horário errado; é preciso testar viradas de dia (reserva às 23h30) e horário de verão. No MVP, o front só exibe em `America/Sao_Paulo`.
