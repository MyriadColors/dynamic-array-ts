import { run } from "mitata";

const args = process.argv.slice(2);
const suites =
	args.length > 0
		? args
		: [
				"mutations",
				"access",
				"buffer",
				"transform",
				"immutable",
				"usecases",
				"scenarios",
				"iteration",
				"serialization",
				"transfer",
				"raw-view",
				"deque",
				"stack",
				"ring-buffer",
			];

let loadedCount = 0;
for (const suite of suites) {
	try {
		// biome-ignore lint/performance/noAwaitInLoops: benchmark loader requires dynamic import
		await import(`./${suite}`);
		loadedCount++;
	} catch {
		console.error(
			`⚠️  Failed to load benchmark suite '${suite}'. Make sure the file exists (benchmarks/${suite}.ts).`,
		);
	}
}

if (loadedCount > 0) {
	console.log(`Running ${loadedCount} benchmark suite(s)...`);
	await run();
} else {
	console.error("No valid benchmark suites were loaded.");
	process.exit(1);
}
