import { useCallback, useRef, useState } from "react";

/**
 * PageInfo type for pagination
 */
export interface PageInfo {
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	startCursor: string | null;
	endCursor: string | null;
}

/**
 * Connection edge type
 */
export interface Edge<T> {
	node: T;
	cursor: string;
}

/**
 * Connection type for Relay-style pagination
 */
export interface Connection<T> {
	edges: Edge<T>[];
	pageInfo: PageInfo;
}

interface UsePaginationOptions {
	pageSize?: number;
}

interface UsePaginationResult<T> {
	items: T[];
	pageInfo: PageInfo | null;
	isLoadingMore: boolean;
	isLoadingPrev: boolean;
	hasMore: boolean;
	hasPrev: boolean;
	loadMore: () => Promise<void>;
	loadPrev: () => Promise<void>;
	reset: () => void;
	setInitialData: (connection: Connection<T>) => void;
}

export function usePagination<T>(
	fetchMore: (args: {
		first?: number;
		after?: string;
		last?: number;
		before?: string;
	}) => Promise<Connection<T>>,
	options: UsePaginationOptions = {},
): UsePaginationResult<T> {
	const { pageSize = 20 } = options;

	const [items, setItems] = useState<T[]>([]);
	const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [isLoadingPrev, setIsLoadingPrev] = useState(false);

	// Prevent duplicate fetches
	const loadingMoreRef = useRef(false);
	const loadingPrevRef = useRef(false);

	const setInitialData = useCallback((connection: Connection<T>) => {
		setItems(connection.edges.map((e) => e.node));
		setPageInfo(connection.pageInfo);
	}, []);

	const loadMore = useCallback(async () => {
		if (
			loadingMoreRef.current ||
			!pageInfo?.hasNextPage ||
			!pageInfo?.endCursor
		) {
			return;
		}

		loadingMoreRef.current = true;
		setIsLoadingMore(true);

		try {
			const result = await fetchMore({
				first: pageSize,
				after: pageInfo.endCursor,
			});

			setItems((prev) => [...prev, ...result.edges.map((e) => e.node)]);
			setPageInfo(result.pageInfo);
		} finally {
			setIsLoadingMore(false);
			loadingMoreRef.current = false;
		}
	}, [fetchMore, pageInfo, pageSize]);

	const loadPrev = useCallback(async () => {
		if (
			loadingPrevRef.current ||
			!pageInfo?.hasPreviousPage ||
			!pageInfo?.startCursor
		) {
			return;
		}

		loadingPrevRef.current = true;
		setIsLoadingPrev(true);

		try {
			const result = await fetchMore({
				last: pageSize,
				before: pageInfo.startCursor,
			});

			setItems((prev) => [...result.edges.map((e) => e.node), ...prev]);
			setPageInfo((prev) =>
				prev
					? {
							...prev,
							hasPreviousPage: result.pageInfo.hasPreviousPage,
							startCursor: result.pageInfo.startCursor,
						}
					: result.pageInfo,
			);
		} finally {
			setIsLoadingPrev(false);
			loadingPrevRef.current = false;
		}
	}, [fetchMore, pageInfo, pageSize]);

	const reset = useCallback(() => {
		setItems([]);
		setPageInfo(null);
		setIsLoadingMore(false);
		setIsLoadingPrev(false);
		loadingMoreRef.current = false;
		loadingPrevRef.current = false;
	}, []);

	return {
		items,
		pageInfo,
		isLoadingMore,
		isLoadingPrev,
		hasMore: pageInfo?.hasNextPage ?? false,
		hasPrev: pageInfo?.hasPreviousPage ?? false,
		loadMore,
		loadPrev,
		reset,
		setInitialData,
	};
}
