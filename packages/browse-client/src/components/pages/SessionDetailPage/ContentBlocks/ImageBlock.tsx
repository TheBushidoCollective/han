/**
 * Image Block Component
 *
 * Renders base64 encoded images from Claude Code messages.
 * Supports screenshots, diagrams, and other visual content.
 */

import type React from "react";
import { useState } from "react";
import { Box } from "@/components/atoms/Box.tsx";
import { Button } from "@/components/atoms/Button.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";

interface ImageBlockProps {
	mediaType: string;
	dataUrl: string;
}

export function ImageBlock({
	mediaType,
	dataUrl,
}: ImageBlockProps): React.ReactElement {
	const [expanded, setExpanded] = useState(false);

	// Extract file type from media type
	const fileType = mediaType.split("/")[1]?.toUpperCase() || "IMAGE";

	return (
		<Box className="content-block image-block">
			<HStack className="image-header" gap="sm" align="center">
				<Text className="image-icon" size="md">
					🖼️
				</Text>
				<Text size="sm" weight="semibold">
					Image
				</Text>
				<Text size="xs" color="muted">
					{fileType}
				</Text>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setExpanded(!expanded)}
					style={{ marginLeft: "auto", fontSize: "11px" }}
				>
					{expanded ? "▼ Collapse" : "▶ Expand"}
				</Button>
			</HStack>
			{expanded && (
				<Box className="image-content">
					<img
						src={dataUrl}
						alt="Message attachment"
						style={{
							maxWidth: "100%",
							maxHeight: "500px",
							objectFit: "contain",
							borderRadius: "4px",
							marginTop: "8px",
						}}
					/>
				</Box>
			)}
		</Box>
	);
}
