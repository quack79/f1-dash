import { type ReactNode } from "react";

import "@/styles/globals.css";

import EnvScript from "@/env-script";
import OledModeProvider from "@/components/OledModeProvider";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

export { metadata } from "@/metadata";
export { viewport } from "@/viewport";

type Props = Readonly<{
	children: ReactNode;
}>;

export default function RootLayout({ children }: Props) {
	return (
		<html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} font-sans text-white`}>
			<head>
				<EnvScript />
			</head>

			<body>
				<OledModeProvider>{children}</OledModeProvider>
			</body>
		</html>
	);
}
