import { AnimatePresence, LayoutGroup } from "motion/react";
import clsx from "clsx";

import { useSettingsStore } from "@/stores/useSettingsStore";
import { useDataStore } from "@/stores/useDataStore";

import { sortPos } from "@/lib/sorting";

import Driver from "@/components/driver/Driver";

export default function LeaderBoard() {
	const drivers = useDataStore(({ state }) => state?.DriverList);
	const driversTiming = useDataStore(({ state }) => state?.TimingData);

	const showTableHeader = useSettingsStore((state) => state.tableHeaders);

	return (
		<div className="flex w-fit flex-col gap-0.5">
			{showTableHeader && <TableHeaders />}

			{(!drivers || !driversTiming) &&
				// eslint-disable-next-line @eslint-react/no-array-index-key
				new Array(20).fill("").map((_, index) => <SkeletonDriver key={`driver.loading.${index}`} />)}

			<LayoutGroup key="drivers">
				{drivers && driversTiming && (
					<AnimatePresence>
						{Object.values(driversTiming.Lines)
							.sort(sortPos)
							.filter((timingDriver) => drivers[timingDriver.RacingNumber] !== undefined)
							.map((timingDriver, index) => (
								<Driver
									key={`leaderBoard.driver.${timingDriver.RacingNumber}`}
									position={index + 1}
									driver={drivers[timingDriver.RacingNumber]}
									timingDriver={timingDriver}
								/>
							))}
					</AnimatePresence>
				)}
			</LayoutGroup>
		</div>
	);
}

const TableHeaders = () => {
	return (
		<div
			className="grid items-center gap-2 p-1 px-2 text-sm font-medium text-zinc-500"
			style={{
				gridTemplateColumns: "5.5rem 3.5rem 5.5rem 4rem 5rem 5.5rem auto",
			}}
		>
			<p>Position</p>
			<p>PIT</p>
			<p>Tire</p>
			<p>Info</p>
			<p>Gap</p>
			<p>LapTime</p>
			<p>Sectors</p>
		</div>
	);
};

const SkeletonDriver = () => {
	const animateClass = "h-8 animate-pulse rounded-md bg-zinc-800";

	return (
		<div
			className="grid items-center gap-2 p-1.5"
			style={{
				gridTemplateColumns: "5.5rem 3.5rem 5.5rem 4rem 5rem 5.5rem auto",
			}}
		>
			<div className={animateClass} style={{ width: "100%" }} />

			<div className={animateClass} style={{ width: "100%" }} />

			<div className="flex w-full gap-2">
				<div className={clsx(animateClass, "w-8")} />

				<div className="flex flex-1 flex-col gap-1">
					<div className={clsx(animateClass, "h-4!")} />
					<div className={clsx(animateClass, "h-3! w-2/3")} />
				</div>
			</div>

			{new Array(2).fill(null).map((_, index) => (
				// eslint-disable-next-line @eslint-react/no-array-index-key
				<div className="flex w-full flex-col gap-1" key={`skeleton.${index}`}>
					<div className={clsx(animateClass, "h-4!")} />
					<div className={clsx(animateClass, "h-3! w-2/3")} />
				</div>
			))}

			<div className="flex w-full flex-col gap-1">
				<div className={clsx(animateClass, "h-3! w-4/5")} />
				<div className={clsx(animateClass, "h-4!")} />
			</div>

			<div className="flex w-full gap-1">
				{new Array(3).fill(null).map((_, index) => (
					// eslint-disable-next-line @eslint-react/no-array-index-key
					<div className="flex w-full flex-col gap-1" key={`skeleton.sector.${index}`}>
						<div className={clsx(animateClass, "h-4!")} />
						<div className={clsx(animateClass, "h-3! w-2/3")} />
					</div>
				))}
			</div>
		</div>
	);
};
