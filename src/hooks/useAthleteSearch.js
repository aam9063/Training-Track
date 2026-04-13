import { useState, useRef } from 'react';
import { getAthletes } from '../services/athleteService';

export default function useAthleteSearch(userId) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const athletesCacheRef = useRef(null);

  const loadAthletes = async () => {
    if (athletesCacheRef.current || !userId) return athletesCacheRef.current || [];
    const { data } = await getAthletes(userId);
    athletesCacheRef.current = data || [];
    return athletesCacheRef.current;
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    const athletes = await loadAthletes();
    const q = query.toLowerCase();
    const filtered = athletes.filter((a) =>
      a.first_name?.toLowerCase().includes(q) ||
      a.last_name?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q)
    ).slice(0, 6);
    setSearchResults(filtered);
    setShowSearchResults(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  return { searchQuery, searchResults, showSearchResults, setShowSearchResults, handleSearch, clearSearch };
}
