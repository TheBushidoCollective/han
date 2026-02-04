declare module "react-native-web" {
	import type {
		CSSProperties,
		ReactNode,
		Ref,
		ForwardRefExoticComponent,
		RefAttributes,
		MouseEvent,
		KeyboardEvent,
		UIEvent,
	} from "react";

	// Transform type for CSS transforms
	type TransformValue =
		| { perspective: number }
		| { rotate: string }
		| { rotateX: string }
		| { rotateY: string }
		| { rotateZ: string }
		| { scale: number }
		| { scaleX: number }
		| { scaleY: number }
		| { translateX: number | string }
		| { translateY: number | string }
		| { skewX: string }
		| { skewY: string }
		| { matrix: number[] }
		| { matrix3d: number[] };

	// Accessibility state type
	interface AccessibilityState {
		disabled?: boolean;
		selected?: boolean;
		checked?: boolean | "mixed";
		busy?: boolean;
		expanded?: boolean;
	}

	// Layout event type
	interface LayoutEvent {
		nativeEvent: {
			layout: {
				x: number;
				y: number;
				width: number;
				height: number;
			};
		};
	}

	// Press event type
	interface PressEvent {
		nativeEvent: {
			locationX: number;
			locationY: number;
			pageX: number;
			pageY: number;
			timestamp: number;
		};
	}

	// Web-specific style extensions
	export interface ViewStyle {
		// Layout
		display?:
			| "none"
			| "flex"
			| "grid"
			| "inline-grid"
			| "block"
			| "inline-block"
			| "contents";
		flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
		flexWrap?: "wrap" | "nowrap" | "wrap-reverse";
		justifyContent?:
			| "flex-start"
			| "flex-end"
			| "center"
			| "space-between"
			| "space-around"
			| "space-evenly";
		alignItems?:
			| "flex-start"
			| "flex-end"
			| "center"
			| "stretch"
			| "baseline"
			| string;
		alignContent?:
			| "flex-start"
			| "flex-end"
			| "center"
			| "stretch"
			| "space-between"
			| "space-around";
		alignSelf?:
			| "auto"
			| "flex-start"
			| "flex-end"
			| "center"
			| "stretch"
			| "baseline";
		flex?: number;
		flexGrow?: number;
		flexShrink?: number;
		flexBasis?: number | string;

		// CSS Grid
		gridTemplateColumns?: string;
		gridTemplateRows?: string;
		gridGap?: string | number;
		gap?: string | number;
		gridColumn?: string;
		gridRow?: string;
		placeItems?: string;
		justifyItems?: string;

		// Overflow
		overflow?: "visible" | "hidden" | "scroll" | "auto";
		overflowX?: "auto" | "scroll" | "hidden" | "visible";
		overflowY?: "auto" | "scroll" | "hidden" | "visible";

		// Position
		position?: "absolute" | "relative" | "static" | "fixed" | "sticky";
		top?: number | string;
		bottom?: number | string;
		left?: number | string;
		right?: number | string;
		zIndex?: number;

		// Dimensions
		width?: number | string;
		height?: number | string;
		minWidth?: number | string;
		minHeight?: number | string;
		maxWidth?: number | string;
		maxHeight?: number | string;

		// Padding
		padding?: number | string;
		paddingTop?: number | string;
		paddingBottom?: number | string;
		paddingLeft?: number | string;
		paddingRight?: number | string;
		paddingHorizontal?: number | string;
		paddingVertical?: number | string;

		// Margin
		margin?: number | string;
		marginTop?: number | string;
		marginBottom?: number | string;
		marginLeft?: number | string;
		marginRight?: number | string;
		marginHorizontal?: number | string;
		marginVertical?: number | string;

		// Border
		border?: string;
		borderTop?: string;
		borderBottom?: string;
		borderLeft?: string;
		borderRight?: string;
		borderWidth?: number;
		borderTopWidth?: number;
		borderBottomWidth?: number;
		borderLeftWidth?: number;
		borderRightWidth?: number;
		borderColor?: string;
		borderTopColor?: string;
		borderBottomColor?: string;
		borderLeftColor?: string;
		borderRightColor?: string;
		borderStyle?: "solid" | "dotted" | "dashed" | "none";
		borderRadius?: number | string;
		borderTopLeftRadius?: number | string;
		borderTopRightRadius?: number | string;
		borderBottomLeftRadius?: number | string;
		borderBottomRightRadius?: number | string;

		// Background
		backgroundColor?: string;
		backgroundImage?: string;
		backgroundSize?: string;
		backgroundPosition?: string;
		backgroundRepeat?: string;

		// Shadow
		shadowColor?: string;
		shadowOffset?: { width: number; height: number };
		shadowOpacity?: number;
		shadowRadius?: number;
		boxShadow?: string;
		elevation?: number;

		// Other
		opacity?: number;
		cursor?: CSSProperties["cursor"];
		boxSizing?: "border-box" | "content-box";
		userSelect?: "none" | "auto" | "text" | "all";
		pointerEvents?: "auto" | "none" | "box-none" | "box-only" | string;
		transition?: string;
		animation?: string;
		transform?: TransformValue[] | string;
		outline?: string;
		textAlign?: "left" | "center" | "right" | "justify";
		whiteSpace?: "normal" | "nowrap" | "pre" | "pre-wrap" | "pre-line";
		wordBreak?: "normal" | "break-all" | "keep-all" | "break-word";
		color?: string;

		// Text properties (also available on ViewStyle for web)
		fontFamily?: string;
		fontSize?: number | string;
		fontWeight?:
			| "normal"
			| "bold"
			| "100"
			| "200"
			| "300"
			| "400"
			| "500"
			| "600"
			| "700"
			| "800"
			| "900"
			| number
			| string;
		lineHeight?: number | string;

		// Web scroll behavior
		scrollBehavior?: "auto" | "smooth";

		// Web-specific text properties (also available on ViewStyle for web compatibility)
		textDecoration?: string;
		textOverflow?: "clip" | "ellipsis";
		wordBreak?: "normal" | "break-all" | "keep-all" | "break-word";
		overflowWrap?: "normal" | "break-word" | "anywhere";

		// Allow any additional CSS properties for web compatibility
		[key: string]: unknown;
	}

	export interface TextStyle extends ViewStyle {
		// Text-specific
		fontFamily?: string;
		fontSize?: number | string;
		fontWeight?:
			| "normal"
			| "bold"
			| "100"
			| "200"
			| "300"
			| "400"
			| "500"
			| "600"
			| "700"
			| "800"
			| "900"
			| number
			| string;
		fontStyle?: "normal" | "italic";
		lineHeight?: number | string;
		letterSpacing?: number;
		textDecorationLine?:
			| "none"
			| "underline"
			| "line-through"
			| "underline line-through";
		textDecorationStyle?: "solid" | "double" | "dotted" | "dashed";
		textDecorationColor?: string;
		textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
		textShadowColor?: string;
		textShadowOffset?: { width: number; height: number };
		textShadowRadius?: number;

		// Web-specific text
		textOverflow?: "clip" | "ellipsis";
		wordBreak?: "normal" | "break-all" | "keep-all" | "break-word";
		overflowWrap?: "normal" | "break-word" | "anywhere";
	}

	export type ImageStyle = ViewStyle & {
		resizeMode?: "cover" | "contain" | "stretch" | "repeat" | "center";
		tintColor?: string;
	};

	// View Props
	export interface ViewProps {
		children?: ReactNode;
		style?: ViewStyle | ViewStyle[] | (ViewStyle | false | null | undefined)[];
		className?: string;
		id?: string;
		ref?: Ref<HTMLDivElement>;
		onClick?: (event: MouseEvent<HTMLDivElement>) => void;
		onPress?: (event: PressEvent) => void;
		onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
		onScroll?: (event: UIEvent<HTMLDivElement>) => void;
		onLayout?: (event: LayoutEvent) => void;
		role?: string;
		tabIndex?: number;
		accessibilityLabel?: string;
		accessibilityRole?: string;
		accessibilityState?: AccessibilityState;
		testID?: string;
		"aria-label"?: string;
		"aria-hidden"?: boolean;
		"aria-expanded"?: boolean;
		"aria-selected"?: boolean;
		"data-testid"?: string;
		pointerEvents?: "auto" | "none" | "box-none" | "box-only";
	}

	// Text Props
	export interface TextProps {
		children?: ReactNode;
		style?: TextStyle | TextStyle[] | (TextStyle | false | null | undefined)[];
		className?: string;
		id?: string;
		ref?: Ref<HTMLSpanElement>;
		onClick?: (event: MouseEvent<HTMLSpanElement>) => void;
		onPress?: (event: PressEvent) => void;
		title?: string;
		role?: string;
		tabIndex?: number;
		numberOfLines?: number;
		ellipsizeMode?: "head" | "middle" | "tail" | "clip";
		selectable?: boolean;
		accessibilityLabel?: string;
		accessibilityRole?: string;
		testID?: string;
		"aria-label"?: string;
		"data-testid"?: string;
	}

	// Generic props for other components
	interface GenericProps {
		children?: ReactNode;
		style?: ViewStyle | ViewStyle[];
		className?: string;
		testID?: string;
	}

	// Components
	export const View: ForwardRefExoticComponent<
		ViewProps & RefAttributes<HTMLDivElement>
	>;
	export const Text: ForwardRefExoticComponent<
		TextProps & RefAttributes<HTMLSpanElement>
	>;
	export const Image: ForwardRefExoticComponent<
		GenericProps & RefAttributes<HTMLImageElement>
	>;
	export const ScrollView: ForwardRefExoticComponent<
		GenericProps & RefAttributes<HTMLDivElement>
	>;
	export const TextInput: ForwardRefExoticComponent<
		GenericProps & RefAttributes<HTMLInputElement>
	>;
	export const TouchableOpacity: ForwardRefExoticComponent<
		GenericProps & RefAttributes<HTMLDivElement>
	>;
	export const TouchableHighlight: ForwardRefExoticComponent<
		GenericProps & RefAttributes<HTMLDivElement>
	>;
	export const TouchableWithoutFeedback: ForwardRefExoticComponent<
		GenericProps & RefAttributes<HTMLDivElement>
	>;
	export const Pressable: ForwardRefExoticComponent<
		GenericProps & RefAttributes<HTMLDivElement>
	>;
	export const ActivityIndicator: ForwardRefExoticComponent<
		GenericProps & RefAttributes<HTMLDivElement>
	>;
	export const FlatList: ForwardRefExoticComponent<
		GenericProps & RefAttributes<HTMLDivElement>
	>;
	export const SectionList: ForwardRefExoticComponent<
		GenericProps & RefAttributes<HTMLDivElement>
	>;
	export const Modal: ForwardRefExoticComponent<
		GenericProps & RefAttributes<HTMLDivElement>
	>;
	export const SafeAreaView: ForwardRefExoticComponent<
		GenericProps & RefAttributes<HTMLDivElement>
	>;
	export const KeyboardAvoidingView: ForwardRefExoticComponent<
		GenericProps & RefAttributes<HTMLDivElement>
	>;

	// Animated namespace
	export const Animated: {
		View: ForwardRefExoticComponent<ViewProps & RefAttributes<HTMLDivElement>>;
		Text: ForwardRefExoticComponent<TextProps & RefAttributes<HTMLSpanElement>>;
		Image: ForwardRefExoticComponent<
			GenericProps & RefAttributes<HTMLImageElement>
		>;
		ScrollView: ForwardRefExoticComponent<
			GenericProps & RefAttributes<HTMLDivElement>
		>;
		Value: new (value: number) => { setValue: (value: number) => void };
		timing: (
			value: { setValue: (value: number) => void },
			config: { toValue: number; duration?: number; useNativeDriver?: boolean },
		) => { start: (callback?: () => void) => void };
		spring: (
			value: { setValue: (value: number) => void },
			config: { toValue: number; useNativeDriver?: boolean },
		) => { start: (callback?: () => void) => void };
	};

	// Listener type for event subscriptions
	interface EventSubscription {
		remove: () => void;
	}

	export const Dimensions: {
		get: (dim: "window" | "screen") => { width: number; height: number };
		addEventListener: (
			type: string,
			handler: (dims: {
				window: { width: number; height: number };
				screen: { width: number; height: number };
			}) => void,
		) => EventSubscription;
		removeEventListener: (
			type: string,
			handler: (dims: {
				window: { width: number; height: number };
				screen: { width: number; height: number };
			}) => void,
		) => void;
	};
	export const Platform: {
		OS: "web" | "ios" | "android";
		select: <T>(specifics: {
			web?: T;
			ios?: T;
			android?: T;
			default?: T;
		}) => T | undefined;
		Version: number;
	};
	export const PixelRatio: {
		get: () => number;
		getFontScale: () => number;
		getPixelSizeForLayoutSize: (layoutSize: number) => number;
		roundToNearestPixel: (layoutSize: number) => number;
	};
	export const Appearance: {
		getColorScheme: () => "light" | "dark" | null;
		addChangeListener: (
			listener: (preferences: { colorScheme: "light" | "dark" | null }) => void,
		) => EventSubscription;
	};
	export const useColorScheme: () => "light" | "dark" | null;
	export const useWindowDimensions: () => { width: number; height: number };
	export const Linking: {
		openURL: (url: string) => Promise<void>;
		canOpenURL: (url: string) => Promise<boolean>;
		getInitialURL: () => Promise<string | null>;
		addEventListener: (
			type: string,
			handler: (event: { url: string }) => void,
		) => EventSubscription;
		removeEventListener: (
			type: string,
			handler: (event: { url: string }) => void,
		) => void;
	};
	export const Clipboard: {
		getString: () => Promise<string>;
		setString: (text: string) => void;
	};

	// StyleSheet
	export const StyleSheet: {
		create: <T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(
			styles: T,
		) => T;
		flatten: <T extends ViewStyle | TextStyle | ImageStyle>(
			style: T | T[] | (T | false | null | undefined)[] | undefined,
		) => T;
		absoluteFill: ViewStyle;
		absoluteFillObject: ViewStyle;
		hairlineWidth: number;
	};
}
