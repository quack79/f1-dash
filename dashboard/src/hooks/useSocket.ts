import { useEffect, useRef, useState } from "react";

import type { MessageInitial, MessageUpdate } from "@/types/message.type";

import { env } from "@/env";

type Props = {
	handleInitial: (data: MessageInitial) => void;
	handleUpdate: (data: MessageUpdate) => void;
};

export const useSocket = ({ handleInitial, handleUpdate }: Props) => {
	const [connected, setConnected] = useState<boolean>(false);
	const handleInitialRef = useRef(handleInitial);
	const handleUpdateRef = useRef(handleUpdate);

	useEffect(() => {
		handleInitialRef.current = handleInitial;
		handleUpdateRef.current = handleUpdate;
	});

	useEffect(() => {
		const sse = new EventSource(`${env.NEXT_PUBLIC_LIVE_URL}/api/realtime`);

		sse.onerror = () => setConnected(false);
		sse.onopen = () => setConnected(true);

		const onInitial = (message: MessageEvent) => handleInitialRef.current(JSON.parse(message.data));
		const onUpdate = (message: MessageEvent) => handleUpdateRef.current(JSON.parse(message.data));

		sse.addEventListener("initial", onInitial);
		sse.addEventListener("update", onUpdate);

		return () => {
			sse.removeEventListener("initial", onInitial);
			sse.removeEventListener("update", onUpdate);
			sse.close();
		};
	}, []);

	return { connected };
};
