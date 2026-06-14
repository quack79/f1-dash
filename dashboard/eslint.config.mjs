import { defineConfig, globalIgnores } from "eslint/config";
import eslintReact from "@eslint-react/eslint-plugin";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
	// TypeScript recommended rules (parser + base + recommended)
	...tseslint.configs.recommended,

	// Next.js core-web-vitals rules — registers the @next/next plugin and its rules
	nextPlugin.configs["core-web-vitals"],

	// React + react-hooks + Prettier — applied to every JS/TS source file
	{
		files: ["**/*.{js,jsx,mjs,ts,tsx}"],
		extends: [eslintReact.configs.recommended],
		plugins: {
			prettier,
			"react-hooks": reactHooks,
		},
		rules: {
			"prettier/prettier": "error",
		},
	},

	// Disable stylistic ESLint rules that conflict with Prettier — must come last
	prettierConfig,

	// Keep the same global ignores as before (.next/**, out/**, build/**)
	globalIgnores(["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
