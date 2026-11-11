export const DEBUG = false;

export const SAFE_OVERRIDES: Readonly<Record<string, string>> = Object.freeze(
	Object.assign(Object.create(null), {
		pop: "safePop",
		shift: "safeShift",
		splice: "safeSplice",
		truncate: "safeTruncate",
		clear: "safeClear",
	}),
);

export const SECURED_METHODS: ReadonlySet<string> = new Set([
	"slice",
	"map",
	"filter",
	"concat",
	"pushed",
	"unshifted",
	"shifted",
	"spliced",
	"cleared",
	"truncated",
	"filled",
	"reversed",
	"sorted",
	"sortedWith",
]);
