import { createContext, useCallback, useEffect, useState } from 'react';
import { getCompanySettings } from '../services/companySettingsService.js';

/*
  Fetches company_settings once at the app root and shares it via
  context, so components displaying the company name/logo (Sidebar,
  MobileNav, Login, Home, Dashboard, ...) never hardcode "Henil
  Enterprise" themselves — they read `company.company_name` here,
  which itself falls back to that same string only if no settings
  row exists yet (see companySettingsService.js's DEFAULT_COMPANY).

  refetch() is called by the Settings page after a successful save so
  every consumer picks up the new values immediately, without a full
  page reload.
*/
export const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCompanySettings();
      setCompany(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return <CompanyContext.Provider value={{ company, loading, refetch }}>{children}</CompanyContext.Provider>;
}
