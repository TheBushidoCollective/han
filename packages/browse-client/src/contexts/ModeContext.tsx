/**
 * Mode Context for Team Platform
 *
 * Provides mode detection (local vs hosted) and current user/org context.
 * In local mode, team features are hidden.
 * In hosted mode, team session viewing is enabled.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Org, TeamMember, User } from '../types/auth.ts';

/**
 * Application mode - local for han browse, hosted for team dashboard
 */
export type AppMode = 'local' | 'hosted';

/**
 * Mode context value shape
 */
export interface ModeContextValue {
  mode: AppMode;
  isHosted: boolean;
  isLocal: boolean;
  currentUser: User | null;
  currentOrg: Org | null;
  orgs: Org[];
  orgMembers: TeamMember[];
  isLoadingAuth: boolean;
  setCurrentOrg: (org: Org | null) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

/**
 * Detect application mode from hostname
 * Hosted mode uses dashboard.local.han.guru or similar hosted domains
 */
function detectMode(): AppMode {
  if (typeof window === 'undefined') {
    return 'local';
  }

  const hostname = window.location.hostname;

  // Hosted dashboard domains
  if (
    hostname === 'dashboard.local.han.guru' ||
    hostname.endsWith('.han.guru') ||
    hostname === 'dashboard.han.dev' ||
    hostname.endsWith('.han.dev')
  ) {
    return 'hosted';
  }

  // Local development on localhost or 127.0.0.1
  return 'local';
}

interface ModeProviderProps {
  children: React.ReactNode;
}

/**
 * Mode Provider Component
 *
 * Wraps the app to provide mode context.
 * In hosted mode, fetches current user and org data.
 */
export function ModeProvider({ children }: ModeProviderProps) {
  const mode = useMemo(() => detectMode(), []);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Org | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgMembers, setOrgMembers] = useState<TeamMember[]>([]);
  const [isLoadingAuth, setIsLoadingAuth] = useState(mode === 'hosted');

  // In hosted mode, fetch user and org data
  useEffect(() => {
    if (mode !== 'hosted') {
      setIsLoadingAuth(false);
      return;
    }

    // In hosted mode, we would fetch user/org data from the GraphQL API
    // For now, this is stubbed - the backend team queries will be implemented
    // when the team platform backend is ready
    const fetchAuthData = async () => {
      try {
        // TODO: Implement actual GraphQL queries when backend is ready
        // const { currentUser, orgs } = await fetchCurrentUser();
        // setCurrentUser(currentUser);
        // setOrgs(orgs);
        // if (orgs.length > 0) {
        //   setCurrentOrg(orgs[0]);
        // }

        // For now, set loading to false after a brief delay
        // This stub allows the UI to render correctly in both modes
        setTimeout(() => {
          setIsLoadingAuth(false);
        }, 100);
      } catch (error) {
        console.error('Failed to fetch auth data:', error);
        setIsLoadingAuth(false);
      }
    };

    fetchAuthData();
  }, [mode]);

  // Fetch org members when current org changes
  useEffect(() => {
    if (mode !== 'hosted' || !currentOrg) {
      setOrgMembers([]);
      return;
    }

    // TODO: Implement actual GraphQL query when backend is ready
    // const fetchMembers = async () => {
    //   const members = await fetchOrgMembers(currentOrg.id);
    //   setOrgMembers(members);
    // };
    // fetchMembers();
  }, [mode, currentOrg]);

  const handleSetCurrentOrg = useCallback((org: Org | null) => {
    setCurrentOrg(org);
  }, []);

  const value = useMemo<ModeContextValue>(
    () => ({
      mode,
      isHosted: mode === 'hosted',
      isLocal: mode === 'local',
      currentUser,
      currentOrg,
      orgs,
      orgMembers,
      isLoadingAuth,
      setCurrentOrg: handleSetCurrentOrg,
    }),
    [
      mode,
      currentUser,
      currentOrg,
      orgs,
      orgMembers,
      isLoadingAuth,
      handleSetCurrentOrg,
    ]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

/**
 * Hook to access mode context
 *
 * @throws Error if used outside ModeProvider
 */
export function useMode(): ModeContextValue {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}

/**
 * Hook to check if running in hosted mode
 * Convenience wrapper for common use case
 */
export function useIsHosted(): boolean {
  const { isHosted } = useMode();
  return isHosted;
}
