import type { LazyChain } from "./lazy-chain";
import type {
	ElementType,
	TypedArrayConstructor,
	TypedArrayInstance,
} from "./types";

export interface DynamicArraySecureView<T extends TypedArrayConstructor> {
	readonly length: number;
	readonly capacity: number;
	readonly TypedArrayCtor: T;
	readonly view: TypedArrayInstance<T>;
	readonly maxCapacity: number;
	readonly byteLength: number;
	readonly isEmpty: boolean;
	readonly version: number;

	get(index: number): ElementType<T>;
	at(index: number): ElementType<T> | undefined;
	unsafeGet(index: number): ElementType<T>;
	push(...items: ElementType<T>[]): number;
	pop(): ElementType<T> | undefined;
	safePop(): ElementType<T> | undefined;
	shift(): ElementType<T> | undefined;
	safeShift(): ElementType<T> | undefined;
	unshift(...items: ElementType<T>[]): number;
	set(index: number, value: ElementType<T>): void;
	splice(
		start: number,
		deleteCount?: number,
		...args: (ElementType<T> | { returnDeleted?: boolean })[]
	): ElementType<T>[];
	safeSplice(
		start: number,
		deleteCount?: number,
		...args: (ElementType<T> | { returnDeleted?: boolean })[]
	): ElementType<T>[];
	truncate(newLength: number): void;
	safeTruncate(newLength: number): void;
	clear(): void;
	safeClear(): void;
	slice(start?: number, end?: number): DynamicArraySecureView<T>;
	concat(other: unknown): DynamicArraySecureView<T>;
	map<U extends TypedArrayConstructor = T>(
		callback: (
			value: ElementType<T>,
			index: number,
			array: this,
		) => ElementType<U>,
		TypedArrayCtor?: U,
	): DynamicArraySecureView<U>;
	filter(
		predicate: (value: ElementType<T>, index: number, array: this) => boolean,
	): DynamicArraySecureView<T>;
	secured(): DynamicArraySecureView<T>;
	includes(searchElement: ElementType<T>, fromIndex?: number): boolean;
	toArray(): ElementType<T>[];
	pushAligned(alignment: number, ...values: ElementType<T>[]): this;
	fill(value: ElementType<T>, start?: number, end?: number): this;
	reverse(): this;
	sort(): this;
	sortWith(compareFn: (a: ElementType<T>, b: ElementType<T>) => number): this;
	reserve(minimumCapacity: number): void;
	shrinkToFit(): void;
	compact(): void;
	getTypedArrayCtor(): T;
	raw(): TypedArrayInstance<T>;
	withRaw<R>(fn: (view: TypedArrayInstance<T>) => R): R;
	getRawBuffer(): TypedArrayInstance<T>;
	indexOf(searchElement: ElementType<T>, fromIndex?: number): number;
	timingSafeIndexOf(searchElement: ElementType<T>, fromIndex?: number): number;
	lastIndexOf(searchElement: ElementType<T>, fromIndex?: number): number;
	findIndex(
		predicate: (value: ElementType<T>, index: number, array: this) => boolean,
		fromIndex?: number,
	): number;
	reduce<U>(
		callback: (acc: U, value: ElementType<T>, index: number, array: this) => U,
		initialValue: U,
	): U;
	some(
		predicate: (value: ElementType<T>, index: number, array: this) => boolean,
	): boolean;
	every(
		predicate: (value: ElementType<T>, index: number, array: this) => boolean,
	): boolean;
	forEach(
		callback: (value: ElementType<T>, index: number, array: this) => void,
	): void;
	forEachSnapshot(
		callback: (value: ElementType<T>, index: number, array: this) => void,
	): void;
	pushed(
		...items: (ElementType<T> | ArrayLike<ElementType<T>>)[]
	): DynamicArraySecureView<T>;
	unshifted(...values: ElementType<T>[]): DynamicArraySecureView<T>;
	shifted(): DynamicArraySecureView<T>;
	spliced(
		start: number,
		deleteCount?: number,
		...args: (ElementType<T> | { returnDeleted?: boolean })[]
	): DynamicArraySecureView<T>;
	cleared(shrink?: boolean): DynamicArraySecureView<T>;
	truncated(newLength: number): DynamicArraySecureView<T>;
	filled(
		value: ElementType<T>,
		start?: number,
		end?: number,
	): DynamicArraySecureView<T>;
	reversed(): DynamicArraySecureView<T>;
	sorted(): DynamicArraySecureView<T>;
	sortedWith(
		compareFn: (a: ElementType<T>, b: ElementType<T>) => number,
	): DynamicArraySecureView<T>;
	transfer(): ArrayBuffer;
	toString(): string;
	lazy(): LazyChain<T, ElementType<T>>;
	[Symbol.iterator](): Iterator<ElementType<T>>;
	/**
	 * Returns structured clone data for the array.
	 * @remarks TypeScript cannot type this as a computed property because `Symbol.for()` returns generic `symbol`, not `unique symbol`.
	 */
	// @ts-expect-error Symbol.for() returns generic `symbol`, not `unique symbol` required by TS for computed properties.
	// The method exists at runtime on DynamicArray and the secured proxy delegates it correctly.
	[Symbol.for("structuredClone")](): object;
}
