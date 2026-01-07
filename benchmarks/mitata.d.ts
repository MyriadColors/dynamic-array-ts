declare module "mitata" {
	export interface BenchContext {
		get(name: string): any;
	}

	export function bench(name: string, fn: () => any): any;
	export function bench(fn: (ctx: BenchContext) => any): any;

	export function group(name: string, fn: () => void): void;
	export function group(fn: () => void): void;

	export function do_not_optimize(val: any): any;
}
