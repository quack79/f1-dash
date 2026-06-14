import { useState } from "react";

export const useDevMode = () => {
	const [active] = useState(() => typeof window !== "undefined" && !!localStorage.getItem("dev"));
	return { active };
};
