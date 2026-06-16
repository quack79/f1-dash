import type { Metadata } from "next";

const title = "f1-dash | Formula 1 live timing";
const description =
	"Experience live telemetry and timing data from Formula 1 races. Get insights into leaderboards, tire choices, gaps, lap times, sector times, team radios, and more.";

export const metadata: Metadata = {
	generator: "Next.js",

	applicationName: title,

	title,
	description,

	referrer: "strict-origin-when-cross-origin",

	keywords: ["Formula 1", "f1 dashboard", "realtime telemetry", "f1 timing", "live updates"],

	appleWebApp: {
		capable: true,
		title: "f1-dash",
		statusBarStyle: "black-translucent",
	},

	manifest: "/manifest.json",
};
