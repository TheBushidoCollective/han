import Script from "next/script";

export default function Analytics() {
	const cloudflareToken = process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS;

	if (!cloudflareToken) {
		return null;
	}

	return (
		<Script
			defer
			src="https://static.cloudflareinsights.com/beacon.min.js"
			data-cf-beacon={`{"token": "${cloudflareToken}"}`}
			strategy="afterInteractive"
		/>
	);
}
