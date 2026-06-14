"use client";

import LeaderBoard from "@/components/dashboard/LeaderBoard";
import RaceControl from "@/components/dashboard/RaceControl";
import TeamRadios from "@/components/dashboard/TeamRadios";
import TrackViolations from "@/components/dashboard/TrackViolations";
import Map from "@/components/dashboard/Map";
import Footer from "@/components/Footer";

export default function Page() {
	return (
		<div className="flex w-full flex-col gap-2">
			<div className="flex w-full flex-col gap-2 2xl:grid 2xl:grid-cols-[max-content_minmax(0,1fr)]">
				<div className="overflow-x-auto">
					<LeaderBoard />
				</div>

				<div className="flex min-w-0 flex-col gap-2 2xl:sticky 2xl:top-0 2xl:h-0 2xl:min-h-full">
					<div>
						<Map viewBoxBottomPadding={250} />
					</div>

					<div className="min-h-[20rem] flex-1 overflow-y-auto rounded-lg border border-zinc-800 p-2 2xl:min-h-0">
						<RaceControl />
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-2 divide-y divide-zinc-800 *:h-[30rem] *:overflow-y-auto *:rounded-lg *:border *:border-zinc-800 *:p-2 md:divide-y-0 lg:grid-cols-2">
				<div>
					<TeamRadios />
				</div>

				<div>
					<TrackViolations />
				</div>
			</div>

			<Footer />
		</div>
	);
}
