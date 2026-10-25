"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import LeaderBoard from "@/components/dashboard/LeaderBoard";
import RaceControl from "@/components/dashboard/RaceControl";
import TeamRadios from "@/components/dashboard/TeamRadios";
import TrackViolations from "@/components/dashboard/TrackViolations";
import Map from "@/components/dashboard/Map";
import Footer from "@/components/Footer";
import ResizeHandle, {
	DEFAULT_RACE_CONTROL_HEIGHT,
	MIN_MAP_HEIGHT,
	MIN_RACE_CONTROL_HEIGHT,
} from "@/components/dashboard/ResizeHandle";
import { useSettingsStore } from "@/stores/useSettingsStore";

const GAP = 8;

export default function Page() {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [containerHeight, setContainerHeight] = useState<number | null>(null);
	const [isDragging, setIsDragging] = useState(false);

	const raceControlHeight = useSettingsStore((state) => state.raceControlHeight);
	const setRaceControlHeight = useSettingsStore((state) => state.setRaceControlHeight);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setContainerHeight(entry.contentRect.height);
			}
		});

		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const maxRCHeight = containerHeight ? Math.max(MIN_RACE_CONTROL_HEIGHT, containerHeight - MIN_MAP_HEIGHT - GAP) : 700;

	const effectiveHeight = Math.min(
		Math.max(raceControlHeight ?? DEFAULT_RACE_CONTROL_HEIGHT, MIN_RACE_CONTROL_HEIGHT),
		maxRCHeight,
	);

	return (
		<div className="flex w-full flex-col gap-2">
			<div className="flex w-full flex-col gap-2 2xl:grid 2xl:grid-cols-[max-content_minmax(0,1fr)]">
				<div className="overflow-x-auto">
					<LeaderBoard />
				</div>

				<div
					ref={containerRef}
					className="flex h-[75vh] max-h-[850px] min-h-[550px] min-w-0 flex-col gap-2 2xl:sticky 2xl:top-0 2xl:h-0 2xl:max-h-none 2xl:min-h-full"
				>
					<div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
						<Map viewBoxBottomPadding={250} />
					</div>

					<div
						style={{ height: `${effectiveHeight}px` }}
						className={clsx(
							"relative flex min-h-0 shrink-0 flex-col rounded-lg border bg-zinc-950/20 transition-colors duration-150",
							isDragging ? "border-sky-500/60" : "border-zinc-800",
						)}
					>
						<ResizeHandle
							height={effectiveHeight}
							onHeightChange={setRaceControlHeight}
							minHeight={MIN_RACE_CONTROL_HEIGHT}
							maxHeight={maxRCHeight}
							defaultHeight={DEFAULT_RACE_CONTROL_HEIGHT}
							isDragging={isDragging}
							onDraggingChange={setIsDragging}
						/>

						<div className="flex-1 overflow-y-auto p-2">
							<PanelHeading>Race Control</PanelHeading>
							<RaceControl />
						</div>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-2 divide-y divide-zinc-800 *:h-120 *:overflow-y-auto *:rounded-lg *:border *:border-zinc-800 *:p-2 md:divide-y-0 lg:grid-cols-2">
				<div>
					<PanelHeading>Team Radio</PanelHeading>
					<TeamRadios />
				</div>

				<div>
					<PanelHeading>Track Limits</PanelHeading>
					<TrackViolations />
				</div>
			</div>

			<Footer />
		</div>
	);
}

function PanelHeading({ children }: { children: string }) {
	return (
		<h2 className="sticky -top-2 z-10 -mx-2 -mt-2 mb-2 border-b border-zinc-800 px-2 py-2 text-sm font-medium text-zinc-300 backdrop-blur">
			{children}
		</h2>
	);
}
