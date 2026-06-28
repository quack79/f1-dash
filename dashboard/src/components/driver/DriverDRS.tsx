import clsx from "clsx";

type Props = {
	inPit: boolean;
	pitOut: boolean;
	retired?: boolean;
};

export default function DriverDRS({ inPit, pitOut, retired }: Props) {
	const pit = inPit || pitOut;

	return (
		<span
			className={clsx(
				"text-md inline-flex h-8 w-full items-center justify-center rounded-md border-2 font-mono font-black",
				{
					"border-zinc-700 text-zinc-700": !pit && !retired,
					"border-cyan-500 text-cyan-500": pit && !retired,
					"border-red-500 text-red-500": retired,
				},
			)}
		>
			{retired ? "RET" : "PIT"}
		</span>
	);
}
