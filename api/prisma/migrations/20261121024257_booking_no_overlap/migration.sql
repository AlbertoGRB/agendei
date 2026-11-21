-- Quem impede duas reservas no mesmo horário é o banco (RN07, ADR 0002).
-- O Prisma não representa constraint de exclusão no schema, por isso o SQL
-- é escrito à mão.

-- Permite usar "=" no providerId dentro de um índice GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- A reserva termina depois de começar.
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_time_check" CHECK ("startsAt" < "endsAt");

-- Duas reservas confirmadas do mesmo prestador não podem se sobrepor.
-- O intervalo [início, fim) deixa uma reserva terminar exatamente quando a
-- próxima começa. Reserva cancelada não ocupa o horário (RN06).
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_no_overlap"
  EXCLUDE USING gist (
    "providerId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE ("status" = 'CONFIRMED');
