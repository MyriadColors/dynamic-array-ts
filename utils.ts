const isNodeOrBun =
	typeof process !== "undefined" &&
	process.versions != null &&
	(process.versions.node != null || process.versions.bun != null);

const dxcDlls = ["dxcompiler.dll", "dxil.dll"];

export const WebGPU = {
	hasDxc: (): boolean => {
		if (!isNodeOrBun) return false;
		if (process.platform !== "win32") return true;

		try {
			const globalRequire = (globalThis as unknown as { require?: (id: string) => unknown }).require;
			if (typeof globalRequire !== "function") return false;
			const fs = globalRequire("node:fs") as typeof import("node:fs");
			const path = globalRequire("node:path") as typeof import("node:path");

			const resolveDxcDir = (value?: string): string | undefined => {
				if (!value) return undefined;
				return value.toLowerCase().endsWith(".dll") ? path.dirname(value) : value;
			};

			const hasDxcDlls = (dir: string): boolean =>
				dxcDlls.every((file) => fs.existsSync(path.join(dir, file)));

			const envDirs = [
				process.env.BUN_WEBGPU_DXC_PATH,
				process.env.DXCOMPILER_PATH,
				process.env.DXC_PATH,
			]
				.map(resolveDxcDir)
				.filter((dir): dir is string => Boolean(dir));
			const pathDirs = (process.env.PATH ?? process.env.Path ?? "")
				.split(";")
				.filter(Boolean);
			return [...envDirs, ...pathDirs].some(hasDxcDlls);
		} catch {
			return false;
		}
	},
};
