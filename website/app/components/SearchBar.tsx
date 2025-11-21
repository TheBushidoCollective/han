'use client';

import Fuse from 'fuse.js';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface SearchResult {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  path: string;
}

interface SearchBarProps {
  index: SearchResult[];
  placeholder?: string;
}

export default function SearchBar({
  index,
  placeholder = 'Search plugins, skills, tags...',
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  // Initialize Fuse.js for fuzzy search
  const fuse = useRef(
    new Fuse(index, {
      keys: [
        { name: 'name', weight: 2 },
        { name: 'description', weight: 1 },
        { name: 'tags', weight: 1.5 },
      ],
      threshold: 0.3,
      minMatchCharLength: 2,
    })
  );

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const searchResults = fuse.current.search(query).slice(0, 8);
    setResults(searchResults.map((r) => r.item));
    setIsOpen(searchResults.length > 0);
    setSelectedIndex(0);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + results.length) % results.length
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          window.location.href = results[selectedIndex].path;
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }

  function highlightMatch(text: string, query: string): React.ReactNode {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, idx) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark
              key={`match-${text.slice(0, 20)}-${idx}-${Math.random()}`}
              className="bg-yellow-200 dark:bg-yellow-800"
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  }

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() =>
            query.trim().length >= 2 && results.length > 0 && setIsOpen(true)
          }
          placeholder={placeholder}
          className="w-full px-4 py-2 pl-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent"
        />
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <title>Search icon</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {results.map((result, index) => (
            <Link
              key={result.id}
              href={result.path}
              onClick={() => setIsOpen(false)}
              className={`block px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition ${
                index === selectedIndex ? 'bg-gray-50 dark:bg-gray-700' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {highlightMatch(result.name, query)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {highlightMatch(result.description.slice(0, 100), query)}
                    {result.description.length > 100 && '...'}
                  </div>
                  {result.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {result.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {result.tags.length > 3 && (
                        <span className="inline-block px-2 py-1 text-xs text-gray-500 dark:text-gray-500">
                          +{result.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="ml-2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                  {result.category}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 text-center text-gray-500 dark:text-gray-400">
          No results found for "{query}"
        </div>
      )}
    </div>
  );
}
