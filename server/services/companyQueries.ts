/**
 * Requêtes de lecture pour les paramètres légaux/fiscaux de l'entreprise.
 */

import { query, queryOne } from "../db";
import type { CompanySettings } from "../types/bakery";

export const getCompanySettings = async (): Promise<CompanySettings | null> => {
  return queryOne<CompanySettings>(
    `SELECT establishment_name AS "establishmentName", rccm,
            taxpayer_account AS "taxpayerAccount",
            default_vat_rate AS "defaultVatRate", currency
       FROM company_settings WHERE id = 'default'`,
  );
};

export const updateCompanySettings = async (
  settings: Partial<CompanySettings>,
): Promise<boolean> => {
  await query(
    `INSERT INTO company_settings
       (id, establishment_name, rccm, taxpayer_account, default_vat_rate, currency, updated_at)
     VALUES ('default',$1,$2,$3,$4,$5,now())
     ON CONFLICT (id) DO UPDATE SET
       establishment_name = EXCLUDED.establishment_name,
       rccm = EXCLUDED.rccm,
       taxpayer_account = EXCLUDED.taxpayer_account,
       default_vat_rate = EXCLUDED.default_vat_rate,
       currency = EXCLUDED.currency,
       updated_at = now()`,
    [
      settings.establishmentName ?? null,
      settings.rccm ?? null,
      settings.taxpayerAccount ?? null,
      settings.defaultVatRate ?? 0,
      settings.currency ?? "XOF",
    ],
  );
  return true;
};
