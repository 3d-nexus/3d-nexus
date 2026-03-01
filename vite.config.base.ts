import { builtinModules } from "node:module";
import { defineConfig, type UserConfig } from "vite";
import dts from "vite-plugin-dts";

const BUILTIN_EXTERNALS = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName: string) => `node:${moduleName}`),
]);

export interface PackageBuildOptions {
  entry: string;
  packageName: string;
  external?: string[];
}

export function createLibraryConfig(options: PackageBuildOptions): UserConfig {
  const external = new Set([...(options.external ?? []), ...BUILTIN_EXTERNALS]);

  return defineConfig({
    build: {
      lib: {
        entry: options.entry,
        name: options.packageName,
        fileName: "index",
        formats: ["es"],
      },
      rollupOptions: {
        external: (id) => external.has(id),
      },
      sourcemap: true,
      emptyOutDir: true,
    },
    plugins: [
      dts({
        entryRoot: "src",
        insertTypesEntry: true,
      }),
    ],
    test: {
      environment: "node",
      coverage: {
        reporter: ["text", "html"],
      },
    },
  });
}
