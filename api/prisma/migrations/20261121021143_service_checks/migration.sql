-- RN01 e RN02 também valem no banco, mesmo que uma validação falhe no código.
-- O Prisma não representa CHECK no schema, por isso o SQL é escrito à mão.
ALTER TABLE "Service"
  ADD CONSTRAINT "Service_priceCents_check" CHECK ("priceCents" >= 0),
  ADD CONSTRAINT "Service_durationMinutes_check"
    CHECK ("durationMinutes" BETWEEN 30 AND 480 AND "durationMinutes" % 30 = 0);
