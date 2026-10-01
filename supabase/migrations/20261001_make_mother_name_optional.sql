-- Hello World
-- ============================================================================
-- PRX — TORNA NOME DA MÃE OPCIONAL NO KYC BANCÁRIO
-- ============================================================================

begin;

alter table public.bank_kyc_applications alter column mother_name drop not null;
alter table public.bank_kyc_applications drop constraint if exists bank_kyc_applications_mother_name_check;
alter table public.bank_kyc_applications add constraint bank_kyc_applications_mother_name_check check (mother_name is null or char_length(mother_name) <= 120);

commit;
