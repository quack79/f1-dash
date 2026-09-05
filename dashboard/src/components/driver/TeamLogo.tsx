import clsx from "clsx";

import { logoFileFor } from "@/lib/teamLogos";

type Props = {
	teamName: string;
	className?: string;
};

export default function TeamLogo({ teamName, className }: Props) {
	const logoFile = logoFileFor(teamName);

	if (!logoFile) return null;

	return (
		<div className={clsx("flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-lg", className)}>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={`/team-logos/${logoFile}.svg`}
				alt={teamName}
				className="max-h-full max-w-full object-contain"
				onError={(e) => {
					(e.currentTarget as HTMLImageElement).style.visibility = "hidden";
				}}
			/>
		</div>
	);
}
