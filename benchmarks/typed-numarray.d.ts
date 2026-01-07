declare module "typed-numarray" {
	export interface NumArray {
		at(index: number): number;
		set(index: number, value: number): void;
		push(value: number): void;
		pop(): number | undefined;
		unshift(value: number): void;
		shift(): number | undefined;
		indexOf(value: number): number;
		map(callback: (v: number) => number): NumArray;
		filter(callback: (v: number) => boolean): NumArray;
		reduce<T>(callback: (acc: T, v: number) => T, initialValue: T): T;
		array(): Uint8Array;
	}

	function NumArray(type: string, size: number): NumArray;
	export default NumArray;
}
