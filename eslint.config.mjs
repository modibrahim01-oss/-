import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  // sabbaq تطبيق مستقل يلينت نفسه بإعداده الخاص
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "sabbaq/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
