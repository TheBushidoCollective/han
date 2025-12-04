import Script from "next/script";

export default function Analytics() {
	const goatCounterCode = process.env.NEXT_PUBLIC_GOATCOUNTER_CODE;

	if (!goatCounterCode) {
		return null;
	}

	return (
		<Script
			data-goatcounter={`https://${goatCounterCode}.goatcounter.com/count`}
			async
			src="//gc.zgo.at/count.js"
			strategy="afterInteractive"
		/>
	);
}
