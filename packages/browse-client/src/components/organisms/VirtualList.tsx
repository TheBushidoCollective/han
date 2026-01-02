/**
 * Virtual List Organism
 *
 * High-performance virtualized list using recyclerlistview.
 * Supports infinite scrolling in both directions.
 */

import type React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DataProvider,
  LayoutProvider,
  RecyclerListView,
} from 'recyclerlistview/web';
import { Spinner, theme } from '../atoms/index.ts';

// View types for layout
export const ViewTypes = {
  SESSION_ROW: 'SESSION_ROW',
  PROJECT_CARD: 'PROJECT_CARD',
  MESSAGE_ITEM: 'MESSAGE_ITEM',
  PLUGIN_CARD: 'PLUGIN_CARD',
  LOADING: 'LOADING',
} as const;

export type ViewType = (typeof ViewTypes)[keyof typeof ViewTypes];

interface VirtualListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getItemType?: (item: T, index: number) => ViewType;
  itemHeight: number | ((item: T, index: number) => number);
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
  onEndReached?: () => void;
  onStartReached?: () => void;
  endReachedThreshold?: number;
  startReachedThreshold?: number;
  isLoadingMore?: boolean;
  isLoadingPrev?: boolean;
  keyExtractor?: (item: T, index: number) => string;
  ListEmptyComponent?: ReactNode;
  ListHeaderComponent?: ReactNode;
  ListFooterComponent?: ReactNode;
  /** Index to render from initially (useful for starting at end of list) */
  initialRenderIndex?: number;
  /** Enable dynamic heights - items are measured after render */
  dynamicHeights?: boolean;
}

export function VirtualList<T>({
  data,
  renderItem,
  getItemType,
  itemHeight,
  width = '100%',
  height = '100%',
  style,
  onEndReached,
  onStartReached,
  endReachedThreshold = 200,
  startReachedThreshold = 200,
  isLoadingMore = false,
  isLoadingPrev = false,
  keyExtractor,
  ListEmptyComponent,
  ListHeaderComponent,
  ListFooterComponent,
  initialRenderIndex,
  dynamicHeights = false,
}: VirtualListProps<T>) {
  // Using any here to avoid complex generics with RecyclerListView internal state types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRef = useRef<InstanceType<typeof RecyclerListView> | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container width
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  // Create data provider with a stable reference checker
  const dataProvider = new DataProvider((r1: T, r2: T) => {
    if (keyExtractor) {
      return (
        keyExtractor(r1, data.indexOf(r1)) !==
        keyExtractor(r2, data.indexOf(r2))
      );
    }
    return r1 !== r2;
  }).cloneWithRows(data);

  // Create layout provider
  const layoutProvider = new LayoutProvider(
    (index) => {
      if (getItemType) {
        return getItemType(data[index], index);
      }
      return ViewTypes.SESSION_ROW;
    },
    (_type, dim, index) => {
      dim.width = containerWidth || 800;
      dim.height =
        typeof itemHeight === 'function'
          ? itemHeight(data[index], index)
          : itemHeight;
    }
  );

  // Row renderer - matches RecyclerListView expected signature
  // Items are wrapped in a full-width container to ensure single-column layout
  const rowRenderer = useCallback(
    (
      _type: string | number,
      item: T,
      index: number
    ): React.JSX.Element | React.JSX.Element[] | null => {
      const rendered = renderItem(item, index);
      // Wrap in a full-width div to ensure items don't appear in a grid
      return (
        <div style={{ width: '100%' }}>
          {rendered as React.JSX.Element | React.JSX.Element[] | null}
        </div>
      );
    },
    [renderItem]
  );

  // Scroll handlers
  const handleScroll = useCallback(
    (_rawEvent: unknown, _offsetX: number, offsetY: number) => {
      const scrollElement = containerRef.current?.querySelector(
        '.recycler-list-view'
      ) as HTMLElement | null;
      if (!scrollElement) return;

      const scrollHeight = scrollElement.scrollHeight;
      const clientHeight = scrollElement.clientHeight;

      // Check if near bottom (load more)
      if (
        onEndReached &&
        scrollHeight - offsetY - clientHeight < endReachedThreshold
      ) {
        onEndReached();
      }

      // Check if near top (load prev)
      if (onStartReached && offsetY < startReachedThreshold) {
        onStartReached();
      }
    },
    [onEndReached, onStartReached, endReachedThreshold, startReachedThreshold]
  );

  // Empty state
  if (data.length === 0 && ListEmptyComponent) {
    return (
      <div ref={containerRef} style={{ width, height, ...style }}>
        {ListEmptyComponent}
      </div>
    );
  }

  // Loading indicator components
  const LoadingIndicator = () => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: theme.spacing.lg,
      }}
    >
      <Spinner />
    </div>
  );

  return (
    <div
      ref={containerRef}
      style={{ width, height, position: 'relative', ...style }}
    >
      {ListHeaderComponent}
      {isLoadingPrev && <LoadingIndicator />}
      {containerWidth > 0 && data.length > 0 && (
        <RecyclerListView
          key={`recycler-${containerWidth}`}
          ref={listRef}
          layoutProvider={layoutProvider}
          dataProvider={dataProvider}
          rowRenderer={rowRenderer}
          onScroll={handleScroll}
          initialRenderIndex={initialRenderIndex}
          forceNonDeterministicRendering={dynamicHeights}
          isHorizontal={false}
          scrollViewProps={{
            style: { width: '100%', height: '100%' },
          }}
        />
      )}
      {isLoadingMore && <LoadingIndicator />}
      {ListFooterComponent}
    </div>
  );
}
