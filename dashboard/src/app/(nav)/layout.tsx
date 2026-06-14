import { type ReactNode } from "react";
import Link from "next/link";

import Footer from "@/components/Footer";

type Props = {
	children: ReactNode;
};

export default function Layout({ children }: Props) {
	return (
		<>
			<nav className="sticky top-0 left-0 z-10 flex h-12 w-full items-center justify-between gap-4 border-b border-zinc-800 p-2 px-4 backdrop-blur-lg">
				<div className="flex gap-4">
					<Link className="transition duration-100 active:scale-95" href="/dashboard">
						Dashboard
					</Link>
					<Link className="transition duration-100 active:scale-95" href="/schedule">
						Schedule
					</Link>
					<Link className="transition duration-100 active:scale-95" href="/help">
						Help
					</Link>
				</div>
			</nav>

			<main className="container mx-auto max-w-(--breakpoint-lg) px-4">
				{children}

				<Footer />
			</main>
		</>
	);
}
