declare module "mitata" {
	export interface BenchContext {
		get(name: string): unknown;
	}

	export interface BenchResult {
		args(name: string, values: unknown[]): BenchResult;
	}

	export function bench(
		name: string,
		fn: (ctx: BenchContext) => Generator<() => void>,
	): BenchResult;
	export function bench(fn: (...args: unknown[]) => unknown): BenchResult;
	export function bench(
		name: string,
		fn: (...args: unknown[]) => unknown,
	): BenchResult;

	export function group(name: string, fn: () => void): void;
	export function group(fn: () => void): void;

	export function do_not_optimize<T>(val: T): T;

	export function run(): Promise<unknown>;
}
