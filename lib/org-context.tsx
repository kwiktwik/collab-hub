'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  myRole: 'owner' | 'admin' | 'member';
}

interface OrgContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations');
      const data = await res.json();
      const orgs = data.organizations || [];
      setOrganizations(orgs);
      
      if (orgs.length > 0 && !currentOrg) {
        const savedOrgId = localStorage.getItem('currentOrgId');
        const org = orgs.find((o: Organization) => o.id === savedOrgId) || orgs[0];
        setCurrentOrgState(org);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  const setCurrentOrg = (org: Organization) => {
    setCurrentOrgState(org);
    localStorage.setItem('currentOrgId', org.id);
  };

  return (
    <OrgContext.Provider value={{ 
      organizations, 
      currentOrg, 
      setCurrentOrg, 
      loading,
      refresh: loadOrganizations 
    }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextType {
  const context = useContext(OrgContext);
  // Return safe defaults if not within provider (during SSR or initial render)
  if (!context) {
    return {
      organizations: [],
      currentOrg: null,
      setCurrentOrg: () => {},
      loading: true,
      refresh: async () => {}
    };
  }
  return context;
}
