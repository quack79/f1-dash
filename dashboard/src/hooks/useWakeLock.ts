import { useEffect, useRef } from "react";

export const useWakeLock = () => {
	const wakeLockRef = useRef<null | WakeLockSentinel>(null);

	useEffect(() => {
		if (typeof window !== "undefined") {
			if (!window.isSecureContext) return;

			if (window.location.hostname === "localhost") return;

			if (!("wakeLock" in navigator)) return;

			navigator.wakeLock.request("screen").then((wl) => {
				wakeLockRef.current = wl;
			});
		}

		return () => {
			if (wakeLockRef.current) {
				wakeLockRef.current.release();
			}
		};
	}, []);
};
