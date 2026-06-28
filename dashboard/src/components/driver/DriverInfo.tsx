import clsx from "clsx";

import type { TimingDataDriver } from "@/types/state.type";

type Props = {
	timingDriver: TimingDataDriver;
	gridPos?: number;
};

export default function DriverInfo({ timingDriver, gridPos }: Props) {
	const positionChange = gridPos && gridPos - parseInt(timingDriver.Position);
	const gain = positionChange && positionChange > 0;
	const loss = positionChange && positionChange < 0;

	return (
		<p
			className={clsx("text-lg leading-none font-medium tabular-nums", {
				"text-emerald-500": gain,
				"text-red-500": loss,
				"text-zinc-500": !gain && !loss,
			})}
		>
			{positionChange !== undefined
				? gain
					? `+${positionChange}`
					: loss
						? positionChange
						: "-"
				: `${timingDriver.NumberOfLaps}L`}
		</p>
	);
}
