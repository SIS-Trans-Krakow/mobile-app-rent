import { useCallback, useRef, useState } from 'react';
import api from '../services/api';
import { CompanyItem } from '../types/company';

export function useCompanyLookup(onSelectCompany?: (company: CompanyItem) => void) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CompanyItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyItem | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchCompanies = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const normalized = query.trim();
    if (normalized.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    setShowResults(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/companies', { params: { search: normalized, limit: 10 } });
        setSearchResults(res.data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (selectedCompany) {
      setSelectedCompany(null);
    }
    searchCompanies(text);
  }, [searchCompanies, selectedCompany]);

  const selectCompany = useCallback((company: CompanyItem) => {
    setSelectedCompany(company);
    setSearchQuery(company.name);
    setShowResults(false);
    setSearchResults([]);
    onSelectCompany?.(company);
  }, [onSelectCompany]);

  const clearSelectedCompany = useCallback(() => {
    setSelectedCompany(null);
    setSearchQuery('');
    setShowResults(false);
    setSearchResults([]);
  }, []);

  const setInitialCompany = useCallback((company: CompanyItem | null) => {
    setSelectedCompany(company);
    setSearchQuery(company?.name || '');
    setShowResults(false);
    setSearchResults([]);
    setSearchLoading(false);
  }, []);

  return {
    searchQuery,
    searchResults,
    searchLoading,
    showResults,
    selectedCompany,
    handleSearchChange,
    selectCompany,
    clearSelectedCompany,
    setInitialCompany,
  };
}
