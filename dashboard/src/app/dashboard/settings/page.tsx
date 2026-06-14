"use client";

import Button from "@/components/ui/Button";
import Slider from "@/components/ui/Slider";
import Input from "@/components/ui/Input";

import FavoriteDrivers from "@/components/settings/FavoriteDrivers";

import DelayInput from "@/components/DelayInput";
import DelayTimer from "@/components/DelayTimer";
import Toggle from "@/components/ui/Toggle";

import { useSettingsStore } from "@/stores/useSettingsStore";
import Footer from "@/components/Footer";

export default function SettingsPage() {
	const settings = useSettingsStore();
	return (
		<div>
			<h1 className="mb-4 text-3xl">Settings</h1>

			<h2 className="my-4 text-2xl">Visual</h2>

			<div className="flex gap-2">
				<Toggle enabled={settings.showCornerNumbers} setEnabled={(v) => settings.setShowCornerNumbers(v)} />
				<p className="text-zinc-500">Show Corner Numbers on Track Map</p>
			</div>

			<div className="flex gap-2">
				<Toggle enabled={settings.tableHeaders} setEnabled={(v) => settings.setTableHeaders(v)} />
				<p className="text-zinc-500">Show Driver Table Header</p>
			</div>

			<div className="flex gap-2">
				<Toggle enabled={settings.showBestSectors} setEnabled={(v) => settings.setShowBestSectors(v)} />
				<p className="text-zinc-500">Show Drivers Best Sectors</p>
			</div>

			<div className="flex gap-2">
				<Toggle enabled={settings.showMiniSectors} setEnabled={(v) => settings.setShowMiniSectors(v)} />
				<p className="text-zinc-500">Show Drivers Mini Sectors</p>
			</div>

			<div className="flex gap-2">
				<Toggle enabled={settings.oledMode} setEnabled={(v) => settings.setOledMode(v)} />
				<p className="text-zinc-500">OLED Mode (Pure Black Background)</p>
			</div>

			<div className="flex gap-2">
				<Toggle enabled={settings.useSafetyCarColors} setEnabled={(v) => settings.setUseSafetyCarColors(v)} />
				<p className="text-zinc-500">Use Safety Car Colors</p>
			</div>

			<h2 className="my-4 text-2xl">Race Control</h2>

			<div className="flex gap-2">
				<Toggle enabled={settings.raceControlChime} setEnabled={(v) => settings.setRaceControlChime(v)} />
				<p className="text-zinc-500">Play Chime on new Race Control Message</p>
			</div>

			{settings.raceControlChime && (
				<div className="flex flex-row items-center gap-2">
					<Input
						value={String(settings.raceControlChimeVolume)}
						setValue={(v) => {
							const numericValue = Number(v);
							if (!isNaN(numericValue)) {
								settings.setRaceControlChimeVolume(numericValue);
							}
						}}
					/>
					<Slider
						className="w-52!"
						value={settings.raceControlChimeVolume}
						setValue={(v) => settings.setRaceControlChimeVolume(v)}
					/>

					<p className="text-zinc-500">Race Control Chime Volume</p>
				</div>
			)}

			<h2 className="my-4 text-2xl">Favorite Drivers</h2>

			<p className="mb-4">Select your favorite drivers to highlight them on the dashboard.</p>

			<FavoriteDrivers />

			<h2 className="my-4 text-2xl">Delay</h2>

			<p className="mb-4">
				Set a delay to view data a few seconds behind the live feed. You can also adjust this from the delay input in
				the top bar on the Dashboard page.
			</p>

			<div className="flex items-center gap-2">
				<DelayTimer />
				<DelayInput />
				<p className="text-zinc-500">Delay in seconds</p>
			</div>

			<Button className="mt-2 bg-red-500!" onClick={() => settings.setDelay(0)}>
				Reset delay
			</Button>

			<Footer />
		</div>
	);
}
