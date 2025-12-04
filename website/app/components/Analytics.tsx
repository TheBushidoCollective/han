import Script from "next/script";

export default function Analytics() {
	return (
		<Script
			src="https://cdn.counter.dev/script.js"
			data-id="ffd05d6d-f3a8-45f4-847c-80780a297524"
			data-utcoffset="-7"
			strategy="afterInteractive"
		/>
	);
}
