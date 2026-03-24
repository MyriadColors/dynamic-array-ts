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
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
}
