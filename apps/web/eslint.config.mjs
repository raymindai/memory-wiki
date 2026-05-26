import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/lib/wasm/**",
      // /v8-preview is a design-variant gallery (prototype mocks).
      // It intentionally uses raw <a>, "// comment" text inside h2,
      // hardcoded hex, etc. Don't lint-block the production build
      // on prototype noise.
      "src/app/v8-preview/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
