/**
 * Team name (as sent by the live-timing feed's DriverList.TeamName) -> logo filename under
 * /public/team-logos. Falls back to a slugified version of the name for teams not in the table,
 * so a logo request is still attempted — TeamLogo hides the <img> on a 404 either way.
 */
const LOGO_FILE_BY_TEAM_NAME: Record<string, string> = {
	"red bull racing": "red-bull-racing",
	mercedes: "mercedes",
	ferrari: "ferrari",
	mclaren: "mclaren",
	alpine: "alpine",
	williams: "williams",
	"aston martin": "aston-martin",
	"haas f1 team": "haas-f1-team",
	haas: "haas-f1-team",
	"racing bulls": "racing-bulls",
	"rb f1 team": "racing-bulls",
	audi: "audi",
	"kick sauber": "audi",
	cadillac: "cadillac",
};

const slugify = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "-");

/** Logo filename (without extension) for a team name, or a best-effort slug if unrecognised. */
export const logoFileFor = (teamName: string | undefined): string | undefined =>
	teamName ? (LOGO_FILE_BY_TEAM_NAME[teamName.trim().toLowerCase()] ?? slugify(teamName)) : undefined;
