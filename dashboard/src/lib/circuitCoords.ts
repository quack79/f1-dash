/**
 * Circuit venue coordinates, held locally.
 *
 * The weather map used to geocode `Meeting.Location` against Nominatim on every page load. That's
 * both fragile (a failed/rate-limited lookup silently left the map centred on [0, 0] — off the
 * coast of West Africa) and against Nominatim's usage policy for this kind of client-side traffic.
 * The calendar only has a couple dozen venues and they essentially never move, so a static table
 * keyed by `Meeting.Location` is simpler and can't fail at runtime. Update this table when a new
 * circuit joins the calendar.
 */

type Coords = {
	lat: number;
	lon: number;
};

const COORDS_BY_LOCATION: Record<string, Coords> = {
	sakhir: { lat: 26.0325, lon: 50.5106 },
	jeddah: { lat: 21.6319, lon: 39.1044 },
	melbourne: { lat: -37.8497, lon: 144.968 },
	suzuka: { lat: 34.8431, lon: 136.541 },
	shanghai: { lat: 31.3389, lon: 121.22 },
	miami: { lat: 25.9581, lon: -80.2389 },
	imola: { lat: 44.3439, lon: 11.7167 },
	monaco: { lat: 43.7347, lon: 7.4206 },
	"monte carlo": { lat: 43.7347, lon: 7.4206 },
	madrid: { lat: 40.4652, lon: -3.5987 },
	montreal: { lat: 45.5, lon: -73.5228 },
	spielberg: { lat: 47.2197, lon: 14.7647 },
	silverstone: { lat: 52.0786, lon: -1.0169 },
	"spa-francorchamps": { lat: 50.4372, lon: 5.9714 },
	spa: { lat: 50.4372, lon: 5.9714 },
	budapest: { lat: 47.5789, lon: 19.2486 },
	zandvoort: { lat: 52.3888, lon: 4.5409 },
	monza: { lat: 45.6156, lon: 9.2811 },
	baku: { lat: 40.3725, lon: 49.8533 },
	"marina bay": { lat: 1.2914, lon: 103.864 },
	singapore: { lat: 1.2914, lon: 103.864 },
	austin: { lat: 30.1328, lon: -97.6411 },
	"mexico city": { lat: 19.4042, lon: -99.0907 },
	"sao paulo": { lat: -23.7036, lon: -46.6997 },
	interlagos: { lat: -23.7036, lon: -46.6997 },
	"las vegas": { lat: 36.1147, lon: -115.173 },
	lusail: { lat: 25.49, lon: 51.4542 },
	"yas island": { lat: 24.4672, lon: 54.6031 },
	"yas marina": { lat: 24.4672, lon: 54.6031 },
	"abu dhabi": { lat: 24.4672, lon: 54.6031 },
};

/** Venue coordinates for a session's `Meeting.Location`, or undefined if we don't know it yet. */
export const coordsForCircuit = (location: string | undefined): Coords | undefined =>
	location ? COORDS_BY_LOCATION[location.trim().toLowerCase()] : undefined;
