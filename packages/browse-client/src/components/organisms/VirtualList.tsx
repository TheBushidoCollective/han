/**
 * Virtual List Organism
 *
 * High-performance virtualized list using React Native's FlatList.
 * Supports infinite scrolling in both directions and inverted lists for chat UX.
 */

import type React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from 'react-native';
import { Center } from '../atoms/Center.tsx';
import { theme } from '../atoms/index.ts';
import { Spinner } from '../atoms/Spinner.tsx';

// View types for layout (kept for backwards compatibility)
export const ViewTypes = {
  SESSION_ROW: 'SESSION_ROW',
  PROJECT_CARD: 'PROJECT_CARD',
  MESSAGE_ITEM: 'MESSAGE_ITEM',
  PLUGIN_CARD: 'PLUGIN_CARD',
  LOADING: 'LOADING',
} as const;

export type ViewType = (typeof ViewTypes)[keyof typeof ViewTypes];

export interface VirtualListRef {
  scrollToIndex: (index: number, animated?: boolean) => void;
  scrollToEnd: (animated?: boolean) => void;
  scrollToTop: (animated?: boolean) => void;
}

interface VirtualListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getItemType?: (item: T, index: number) => ViewType;
  /** Estimated height for items */
  itemHeight: number | ((item: T, index: number) => number);
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
  onEndReached?: () => void;
  onStartReached?: () => void;
  /** Threshold as a ratio (0-1) of visible length. Default: 0.5 */
  endReachedThreshold?: number;
  /** Threshold as a ratio (0-1) of visible length. Default: 0.5 */
  startReachedThreshold?: number;
  isLoadingMore?: boolean;
  isLoadingPrev?: boolean;
  keyExtractor?: (item: T, index: number) => string;
  ListEmptyComponent?: ReactNode;
  ListHeaderComponent?: ReactNode;
  ListFooterComponent?: ReactNode;
  /** Index to scroll to initially */
  initialScrollIndex?: number;
  /** Enable inverted list (newest at bottom, like chat) */
  inverted?: boolean;
  /** Callback when tail state changes (for inverted lists: at bottom = tailing) */
  onTailStateChange?: (isTailing: boolean) => void;
  /** Threshold in pixels to consider "at tail". Default: 50 */
  tailThreshold?: number;
  /** @deprecated Not needed with FlatList */
  dynamicHeights?: boolean;
  /** @deprecated Use initialScrollIndex instead */
  initialRenderIndex?: number;
}

function VirtualListInner<T>(
  {
    data,
    renderItem,
    itemHeight,
    width = '100%',
    height = '100%',
    style,
    onEndReached,
    endReachedThreshold = 0.5,
    isLoadingMore = false,
    isLoadingPrev = false,
    keyExtractor,
    ListEmptyComponent,
    ListHeaderComponent,
    ListFooterComponent,
    initialScrollIndex,
    inverted = false,
    onTailStateChange,
    tailThreshold = 50,
    dynamicHeights: _dynamicHeights,
    initialRenderIndex,
  }: VirtualListProps<T>,
  ref: React.ForwardedRef<VirtualListRef>
) {
  const listRef = useRef<FlatList<T>>(null);
  const lastTailStateRef = useRef(true); // Track last state to avoid unnecessary callbacks

  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number, animated = true) => {
      listRef.current?.scrollToIndex({ index, animated });
    },
    scrollToEnd: (animated = true) => {
      listRef.current?.scrollToEnd({ animated });
    },
    scrollToTop: (animated = true) => {
      listRef.current?.scrollToOffset({ offset: 0, animated });
    },
  }));

  // FlatList renderItem adapter
  const flatListRenderItem = useCallback(
    ({ item, index }: { item: T; index: number }) => {
      const rendered = renderItem(item, index);
      return <View style={{ width: '100%' }}>{rendered}</View>;
    },
    [renderItem]
  );

  // FlatList keyExtractor adapter
  const flatListKeyExtractor = useCallback(
    (item: T, index: number) => {
      if (keyExtractor) {
        return keyExtractor(item, index);
      }
      // Default: try to use item.id if available
      const itemWithId = item as { id?: string };
      return itemWithId.id ?? String(index);
    },
    [keyExtractor]
  );

  // Get item layout for performance optimization
  const getItemLayout = useCallback(
    (_data: ArrayLike<T> | null | undefined, index: number) => {
      const height =
        typeof itemHeight === 'function'
          ? itemHeight(data[index], index)
          : itemHeight;
      return {
        length: height,
        offset: height * index,
        index,
      };
    },
    [itemHeight, data]
  );

  // Handle scroll events to track tail state
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!onTailStateChange) return;

      const { contentOffset } = event.nativeEvent;
      // For inverted lists, contentOffset.y near 0 = at visual bottom (tailing)
      // For normal lists, we'd check against contentSize - layoutMeasurement
      const isTailing = inverted ? contentOffset.y < tailThreshold : false; // Non-inverted tail detection would need more info

      // Only fire callback when state changes
      if (isTailing !== lastTailStateRef.current) {
        lastTailStateRef.current = isTailing;
        onTailStateChange(isTailing);
      }
    },
    [onTailStateChange, inverted, tailThreshold]
  );

  // Loading indicator components
  const LoadingIndicator = () => (
    <Center style={{ padding: theme.spacing.lg }}>
      <Spinner />
    </Center>
  );

  // Effective initial scroll index (handle deprecated prop)
  const effectiveInitialScrollIndex = initialScrollIndex ?? initialRenderIndex;

  return (
    <View
      style={[
        {
          width: typeof width === 'number' ? width : '100%',
          height: typeof height === 'number' ? height : '100%',
          flex: 1,
        },
        style as object,
      ]}
    >
      <FlatList
        ref={listRef}
        data={data}
        renderItem={flatListRenderItem}
        keyExtractor={flatListKeyExtractor}
        getItemLayout={
          typeof itemHeight === 'number' ? getItemLayout : undefined
        }
        // Use FlatList's built-in inverted prop for chat UX
        inverted={inverted}
        onEndReached={onEndReached}
        onEndReachedThreshold={endReachedThreshold}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        initialScrollIndex={effectiveInitialScrollIndex}
        ListEmptyComponent={ListEmptyComponent as React.ReactElement}
        ListHeaderComponent={
          <>
            {ListHeaderComponent}
            {isLoadingPrev && <LoadingIndicator />}
          </>
        }
        ListFooterComponent={
          <>
            {isLoadingMore && <LoadingIndicator />}
            {ListFooterComponent}
          </>
        }
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={20}
        windowSize={20}
        initialNumToRender={20}
      />
    </View>
  );
}

// Forward ref with generics support
export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: React.ForwardedRef<VirtualListRef> }
) => React.ReactElement;
