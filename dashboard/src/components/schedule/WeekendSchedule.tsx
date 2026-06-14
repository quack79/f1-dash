import { now, utc } from "moment";
import clsx from "clsx";

import { groupSessionByDay } from "@/lib/groupSessionByDay";

import type { Session } from "@/types/schedule.type";

type Props = {
	sessions: Session[];
};

export default function WeekendSchedule({ sessions }: Props) {
	return (
		<div className="grid grid-cols-3 gap-8 pt-2">
			{groupSessionByDay(sessions).map((day) => (
				<div className="flex flex-col" key={`next.round.day.${day.date}`}>
					<p>{utc(day.date).local().format("dddd")}</p>

					<div className="grid grid-rows-2 gap-2">
						{day.sessions.map((session) => (
							<div
								className={clsx("flex flex-col", utc(session.end).isBefore(now()) && "opacity-50")}
								key={`session.${session.start}`}
							>
								<p className="w-28 overflow-hidden text-ellipsis whitespace-nowrap sm:w-auto">{session.kind}</p>

								<p className="text-sm leading-none text-zinc-500">
									{utc(session.start).local().format("HH:mm")} - {utc(session.end).local().format("HH:mm")}
								</p>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
