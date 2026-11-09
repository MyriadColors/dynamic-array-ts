export const DEBUG = false;

export const SAFE_OVERRIDES: Record<string | symbol, string> = {
	pop: "safePop",
	shift: "safeShift",
	splice: "safeSplice",
	truncate: "safeTruncate",
	clear: "safeClear",
};

export const SECURED_METHODS = new Set([
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
