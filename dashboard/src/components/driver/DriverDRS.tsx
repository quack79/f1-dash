import clsx from "clsx";

type Props = {
	inPit: boolean;
	pitOut: boolean;
};

export default function DriverDRS({ inPit, pitOut }: Props) {
	const pit = inPit || pitOut;

	return (
		<span
			className={clsx(
				"text-md inline-flex h-8 w-full items-center justify-center rounded-md border-2 font-mono font-black",
				{
					"border-zinc-700 text-zinc-700": !pit,
					"border-cyan-500 text-cyan-500": pit,
				},
			)}
		>
			{pit ? "PIT" : "PIT"}
		</span>
	);
}
