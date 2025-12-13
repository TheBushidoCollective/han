import { getNavigation } from "../../lib/docs";
import DocsSidebar from "../components/DocsSidebar";
import Header from "../components/Header";

export default function DocsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const navigation = getNavigation();

	return (
		<div className="min-h-screen bg-white dark:bg-gray-900">
			<Header />
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="flex gap-8">
					<DocsSidebar navigation={navigation.sections} />
					<main className="flex-1 min-w-0">{children}</main>
				</div>
			</div>
		</div>
	);
}
