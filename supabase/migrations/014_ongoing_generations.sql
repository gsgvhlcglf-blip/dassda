-- Preserve fixed ranges; an explicit flag declares the current generation ongoing.
ALTER TABLE public.generations ADD COLUMN ongoing boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.default_generation_ongoing() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.ongoing := coalesce(NEW.ongoing, false);
  RETURN NEW;
END $$;
CREATE TRIGGER default_generation_ongoing BEFORE INSERT OR UPDATE ON public.generations
FOR EACH ROW EXECUTE FUNCTION public.default_generation_ongoing();
-- Application reads resolve the flag to the current Istanbul calendar year.
-- No product compatibility range is extended by this migration or by rollover.
