import type { CarsData, Positions, State } from "@/types/state.type";

import { useDataStore } from "@/stores/useDataStore";

type Fns = {
	updateState: (state: State) => void;
	resetState: (state: State | null) => void;
	updatePosition: (pos: Positions) => void;
	updateCarData: (car: CarsData) => void;
};

export const useStores = (): Fns => {
	const dataStore = useDataStore();

	return {
		updateState: (v) => dataStore.setState(v),
		resetState: (v) => dataStore.resetState(v),
		updatePosition: (v) => dataStore.setPositions(v),
		updateCarData: (v) => dataStore.setCarsData(v),
	};
};
