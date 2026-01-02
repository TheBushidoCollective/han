/**
 * Page Loader Component
 *
 * Reusable component that implements the useQueryLoader + usePreloadedQuery pattern.
 * Automatically loads the query when mounted and provides the queryRef to children.
 */

import type React from 'react';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import type { PreloadedQuery } from 'react-relay';
import { useQueryLoader } from 'react-relay';
import type {
  GraphQLTaggedNode,
  OperationType,
  VariablesOf,
} from 'relay-runtime';
import { theme } from '@/components/atoms';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';

/**
 * Default loading fallback component
 */
function DefaultFallback({
  message = 'Loading...',
}: {
  message?: string;
}): React.ReactElement {
  return (
    <VStack
      align="center"
      justify="center"
      style={{ height: '100%', padding: theme.spacing.xl }}
    >
      <Spinner size="lg" />
      <Text color="secondary" style={{ marginTop: theme.spacing.md }}>
        {message}
      </Text>
    </VStack>
  );
}

interface PageLoaderProps<TQuery extends OperationType> {
  /** The GraphQL query to preload */
  query: GraphQLTaggedNode;
  /** Variables to pass to the query */
  variables?: VariablesOf<TQuery>;
  /** Render function that receives the preloaded query reference */
  children: (queryRef: PreloadedQuery<TQuery>) => React.ReactNode;
  /** Custom loading fallback component */
  fallback?: React.ReactNode;
  /** Message to show in the default fallback */
  loadingMessage?: string;
}

/**
 * PageLoader - Implements the useQueryLoader pattern for pages
 *
 * Usage:
 * ```tsx
 * export default function SessionsPage() {
 *   return (
 *     <PageLoader<SessionsPageQuery>
 *       query={SessionsPageQueryDef}
 *       variables={{ first: 50 }}
 *       loadingMessage="Loading sessions..."
 *     >
 *       {(queryRef) => <SessionsContent queryRef={queryRef} />}
 *     </PageLoader>
 *   );
 * }
 * ```
 */
export function PageLoader<TQuery extends OperationType>({
  query,
  variables,
  children,
  fallback,
  loadingMessage,
}: PageLoaderProps<TQuery>): React.ReactElement {
  const [queryRef, loadQuery, disposeQuery] = useQueryLoader<TQuery>(query);

  // Serialize variables for stable dependency comparison
  // This prevents re-fetching when variables object reference changes but values are the same
  const variablesKey = useMemo(
    () => JSON.stringify(variables ?? {}),
    [variables]
  );

  // Store current variables in a ref so we can access them in the effect
  // without adding to dependencies
  const variablesRef = useRef(variables);
  variablesRef.current = variables;

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadQuery/disposeQuery are stable from useQueryLoader; variablesKey is intentionally used to control when to refetch
  useEffect(() => {
    // Load the query with current variables
    loadQuery(variablesRef.current ?? ({} as VariablesOf<TQuery>));

    // Cleanup on unmount or when variablesKey changes
    return () => {
      disposeQuery();
    };
  }, [variablesKey, loadQuery, disposeQuery]);

  const fallbackElement = fallback ?? (
    <DefaultFallback message={loadingMessage} />
  );

  return (
    <Suspense fallback={fallbackElement}>
      {queryRef && children(queryRef)}
    </Suspense>
  );
}

/**
 * Props for components that receive a preloaded query reference
 */
export interface PreloadedQueryProps<TQuery extends OperationType> {
  queryRef: PreloadedQuery<TQuery>;
}
