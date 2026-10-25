"use client";

import { useEffect, useRef, useCallback } from "react";
import clsx from "clsx";

export const DEFAULT_RACE_CONTROL_HEIGHT = 320;
export const MIN_RACE_CONTROL_HEIGHT = 180;
export const MIN_MAP_HEIGHT = 180;

type ResizeHandleProps = {
	height: number;
	onHeightChange: (height: number) => void;
	minHeight: number;
	maxHeight: number;
	defaultHeight?: number;
	isDragging: boolean;
	onDraggingChange: (isDragging: boolean) => void;
	className?: string;
};

export default function ResizeHandle({
	height,
	onHeightChange,
	minHeight,
	maxHeight,
	defaultHeight = DEFAULT_RACE_CONTROL_HEIGHT,
	isDragging,
	onDraggingChange,
	className,
}: ResizeHandleProps) {
	const startYRef = useRef<number>(0);
	const startHeightRef = useRef<number>(height);
	const handleRef = useRef<HTMLDivElement | null>(null);

	// Keep start height ref in sync when not dragging
	startHeightRef.current = height;

	const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		// Only primary mouse button or touch/pen contact
		if (e.button !== 0) return;

		e.preventDefault();
		startYRef.current = e.clientY;
		startHeightRef.current = height;
		onDraggingChange(true);

		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {
			// Pointer capture may not be supported in all contexts
		}
	};

	const handlePointerMove = useCallback(
		(e: PointerEvent) => {
			if (!isDragging) return;

			// Dragging up increases height, dragging down decreases height
			const deltaY = startYRef.current - e.clientY;
			const targetHeight = startHeightRef.current + deltaY;
			const clamped = Math.min(Math.max(targetHeight, minHeight), maxHeight);
			onHeightChange(clamped);
		},
		[isDragging, minHeight, maxHeight, onHeightChange],
	);

	const handlePointerUp = useCallback(
		(e: PointerEvent) => {
			if (!isDragging) return;

			onDraggingChange(false);

			if (handleRef.current) {
				try {
					handleRef.current.releasePointerCapture(e.pointerId);
				} catch {
					// Ignore
				}
			}
		},
		[isDragging, onDraggingChange],
	);

	useEffect(() => {
		if (!isDragging) return;

		const originalUserSelect = document.body.style.userSelect;
		const originalCursor = document.body.style.cursor;

		document.body.style.userSelect = "none";
		document.body.style.cursor = "row-resize";

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);
		window.addEventListener("pointercancel", handlePointerUp);

		return () => {
			document.body.style.userSelect = originalUserSelect;
			document.body.style.cursor = originalCursor;

			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
			window.removeEventListener("pointercancel", handlePointerUp);
		};
	}, [isDragging, handlePointerMove, handlePointerUp]);

	const handleDoubleClick = () => {
		const clampedDefault = Math.min(Math.max(defaultHeight, minHeight), maxHeight);
		onHeightChange(clampedDefault);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		const step = e.shiftKey ? 40 : 20;

		if (e.key === "ArrowUp") {
			e.preventDefault();
			onHeightChange(Math.min(height + step, maxHeight));
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			onHeightChange(Math.max(height - step, minHeight));
		} else if (e.key === "Home") {
			e.preventDefault();
			onHeightChange(minHeight);
		} else if (e.key === "End") {
			e.preventDefault();
			onHeightChange(maxHeight);
		}
	};

	return (
		<div
			ref={handleRef}
			role="separator"
			aria-orientation="horizontal"
			aria-label="Resize Race Control panel"
			aria-valuenow={Math.round(height)}
			aria-valuemin={minHeight}
			aria-valuemax={maxHeight}
			tabIndex={0}
			onPointerDown={handlePointerDown}
			onDoubleClick={handleDoubleClick}
			onKeyDown={handleKeyDown}
			title="Drag up or down to resize Race Control (Double-click to reset)"
			className={clsx(
				"group absolute inset-x-0 -top-2.5 z-20 flex h-5 cursor-row-resize touch-none items-center justify-center select-none focus-visible:outline-none",
				className,
			)}
		>
			{/* Top accent highlight line */}
			<div
				className={clsx(
					"pointer-events-none absolute inset-x-2 top-1/2 h-px transition-colors duration-150",
					isDragging ? "bg-sky-500/80" : "bg-transparent group-hover:bg-zinc-600/60",
				)}
			/>

			{/* Draggable grip pill */}
			<div
				className={clsx(
					"relative z-10 flex h-1.5 w-12 items-center justify-center rounded-full transition-all duration-150",
					"focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
					isDragging
						? "h-2 w-16 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
						: "bg-zinc-600 group-hover:w-14 group-hover:bg-zinc-400",
				)}
			>
				{/* Subtle grip dots */}
				<div className="flex items-center justify-center gap-1">
					<span className={clsx("h-0.5 w-0.5 rounded-full", isDragging ? "bg-sky-950" : "bg-zinc-900")} />
					<span className={clsx("h-0.5 w-0.5 rounded-full", isDragging ? "bg-sky-950" : "bg-zinc-900")} />
					<span className={clsx("h-0.5 w-0.5 rounded-full", isDragging ? "bg-sky-950" : "bg-zinc-900")} />
				</div>
			</div>
		</div>
	);
}
