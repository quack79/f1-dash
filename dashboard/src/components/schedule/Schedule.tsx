import { connection } from "next/server";

import Round from "@/components/schedule/Round";

import type { Round as RoundType } from "@/types/schedule.type";

import { env } from "@/env";

export const getSchedule = async () => {
	await connection();

	try {
		const scheduleReq = await fetch(`${env.API_URL}/api/schedule`, {
			cache: "no-store",
		});
		const schedule: RoundType[] = await scheduleReq.json();

		return schedule;
	} catch (e) {
		console.error("error fetching schedule", e);
		return null;
	}
};

export default async function Schedule() {
	const schedule = await getSchedule();

	if (!schedule || schedule.length === 0) {
		return (
			<div className="flex h-44 flex-col items-center justify-center">
				<p className="text-zinc-500">
					{!schedule ? "Could not load schedule — check the API service is running." : "No rounds scheduled."}
				</p>
			</div>
		);
	}

	const upcoming = schedule.filter((round) => !round.over).slice(1);

	return (
		<div className="mb-20 grid grid-cols-1 gap-8 md:grid-cols-2">
			{upcoming.map((round) => (
				<Round round={round} key={`round.${round.name}`} />
			))}
		</div>
	);
}
