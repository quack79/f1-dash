"use client";

import { useEffect, useState } from "react";

type DriverStanding = {
	position: string;
	points: string;
	Driver: {
		givenName: string;
		familyName: string;
		permanentNumber: string;
		nationality: string;
	};
	Constructors: {
		constructorId: string;
		name: string;
	}[];
};

type ConstructorStanding = {
	position: string;
	points: string;
	Constructor: {
		constructorId: string;
		name: string;
	};
};

const nationalityToCode: Record<string, string> = {
	Italian: "ita",
	British: "gbr",
	Australian: "aus",
	Monegasque: "mon",
	Dutch: "ned",
	French: "fra",
	Spanish: "esp",
	Brazilian: "bra",
	German: "ger",
	Mexican: "mex",
	Canadian: "can",
	American: "usa",
	"New Zealander": "nzl",
	Argentine: "arg",
	Thai: "tha",
	Finnish: "fin",
	Japanese: "jpn",
	Chinese: "chn",
	Austrian: "aut",
	Belgian: "bel",
	Hungarian: "hun",
	Portuguese: "por",
};

const logoMapper: Record<string, string> = {
	red_bull: "red-bull-racing",
	mercedes: "mercedes",
	ferrari: "ferrari",
	mclaren: "mclaren",
	alpine: "alpine",
	rb: "racing-bulls",
	haas: "haas-f1-team",
	williams: "williams",
	aston_martin: "aston-martin",
	audi: "audi",
	cadillac: "cadillac",
};

const getLogoFileName = (constructorId: string) => {
	const mapped = logoMapper[constructorId.toLowerCase()];
	return mapped || constructorId.toLowerCase();
};

export default function Standings() {
	const [driverStandings, setDriverStandings] = useState<DriverStanding[] | null>(null);
	const [teamStandings, setTeamStandings] = useState<ConstructorStanding[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchStandings = async () => {
			try {
				const [driversRes, constructorsRes] = await Promise.all([
					fetch("https://api.jolpi.ca/ergast/f1/current/driverstandings.json"),
					fetch("https://api.jolpi.ca/ergast/f1/current/constructorstandings.json"),
				]);

				if (!driversRes.ok || !constructorsRes.ok) throw new Error("Failed to fetch data");

				const driversData = await driversRes.json();
				const constructorsData = await constructorsRes.json();

				setDriverStandings(driversData.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || []);
				setTeamStandings(constructorsData.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || []);
			} catch (err) {
				setError("Failed to load championship standings");
				console.error(err);
			}
		};

		fetchStandings();
	}, []);

	return (
		<div className="grid h-full grid-cols-1 divide-y divide-zinc-800 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
			<div className="h-full p-4">
				<h2 className="text-xl">Drivers' Championship</h2>

				{error && <p className="mt-4 text-red-500">{error}</p>}

				<div className="divide flex flex-col divide-y divide-zinc-800">
					{!driverStandings &&
						!error &&
						// eslint-disable-next-line @eslint-react/no-array-index-key
						new Array(20).fill("").map((_, index) => <DriverSkeletonItem key={`driver.loading.${index}`} />)}

					{driverStandings &&
						driverStandings.map((driver) => {
							const team = driver.Constructors[0];
							const flagCode = nationalityToCode[driver.Driver.nationality];
							return (
								<div
									className="grid items-center gap-2 p-2"
									style={{
										gridTemplateColumns: "2rem 24px 1fr 4rem 2rem 24px",
									}}
									key={driver.Driver.permanentNumber || driver.Driver.familyName}
								>
									<p className="font-bold">{driver.position}</p>

									<div className="flex size-6 items-center justify-center overflow-hidden rounded-lg">
										{team && (
											// eslint-disable-next-line @next/next/no-img-element
											<img
												src={`/team-logos/${getLogoFileName(team.constructorId)}.svg`}
												alt={team.name}
												className="max-h-full max-w-full object-contain"
												onError={(e) => {
													(e.currentTarget as HTMLImageElement).style.visibility = "hidden";
												}}
											/>
										)}
									</div>

									<p className="truncate">
										{driver.Driver.givenName} {driver.Driver.familyName}
									</p>

									<p className="text-right whitespace-nowrap">{driver.points} pts</p>

									<p className="text-right font-mono text-zinc-400">{driver.Driver.permanentNumber}</p>

									<div className="overflow-hidden rounded">
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={`/country-flags/${flagCode}.svg`}
											alt={driver.Driver.nationality}
											className="h-4 w-6 object-cover"
											onError={(e) => {
												(e.currentTarget as HTMLImageElement).style.visibility = "hidden";
											}}
										/>
									</div>
								</div>
							);
						})}
				</div>
			</div>

			<div className="h-full p-4">
				<h2 className="text-xl">Team Championship Standings</h2>

				{error && <p className="mt-4 text-red-500">{error}</p>}

				<div className="divide flex flex-col divide-y divide-zinc-800">
					{!teamStandings &&
						!error &&
						// eslint-disable-next-line @eslint-react/no-array-index-key
						new Array(10).fill("").map((_, index) => <TeamSkeletonItem key={`team.loading.${index}`} />)}

					{teamStandings &&
						teamStandings.map((team) => (
							<div
								className="grid items-center gap-2 p-2"
								style={{
									gridTemplateColumns: "2rem 24px 1fr 4rem",
								}}
								key={team.Constructor.constructorId}
							>
								<p className="font-bold">{team.position}</p>

								<div className="flex size-6 items-center justify-center overflow-hidden rounded-lg">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={`/team-logos/${getLogoFileName(team.Constructor.constructorId)}.svg`}
										alt={team.Constructor.name}
										className="max-h-full max-w-full object-contain"
										onError={(e) => {
											// Fallback if image not found
											(e.currentTarget as HTMLImageElement).style.visibility = "hidden";
										}}
									/>
								</div>

								<p className="truncate">{team.Constructor.name}</p>

								<p className="text-right whitespace-nowrap">{team.points} pts</p>
							</div>
						))}
				</div>
			</div>
		</div>
	);
}

const DriverSkeletonItem = () => {
	return (
		<div
			className="grid items-center gap-2 p-2"
			style={{
				gridTemplateColumns: "2rem 24px auto 4rem 2rem 24px",
			}}
		>
			<div className="h-4 w-4 animate-pulse rounded-md bg-zinc-800" />
			<div className="h-6 w-6 animate-pulse rounded-md bg-zinc-800" />
			<div className="h-4 w-32 animate-pulse rounded-md bg-zinc-800" />
			<div className="ml-auto h-4 w-12 animate-pulse rounded-md bg-zinc-800" />
			<div className="h-4 w-6 animate-pulse rounded-md bg-zinc-800" />
			<div className="h-4 w-6 animate-pulse rounded-md bg-zinc-800" />
		</div>
	);
};

const TeamSkeletonItem = () => {
	return (
		<div
			className="grid items-center gap-2 p-2"
			style={{
				gridTemplateColumns: "2rem 24px auto 4rem",
			}}
		>
			<div className="h-4 w-4 animate-pulse rounded-md bg-zinc-800" />
			<div className="h-6 w-6 animate-pulse rounded-md bg-zinc-800" />
			<div className="h-4 w-32 animate-pulse rounded-md bg-zinc-800" />
			<div className="ml-auto h-4 w-12 animate-pulse rounded-md bg-zinc-800" />
		</div>
	);
};
