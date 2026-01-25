import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

namespace WebGPU {
	const dxcDlls = ["dxcompiler.dll", "dxil.dll"];

	const resolveDxcDir = (value?: string): string | undefined => {
		if (!value) return undefined;
		return value.toLowerCase().endsWith(".dll") ? dirname(value) : value;
	};

	const hasDxcDlls = (dir: string): boolean =>
		dxcDlls.every((file) => existsSync(join(dir, file)));

	export const hasDxc = (): boolean => {
		if (process.platform !== "win32") return true;

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
	};
}

export { WebGPU };
