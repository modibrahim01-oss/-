import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // next-env.d.ts مولَّد آليًا بـ Next ويُعاد توليده عند كل بناء
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
];

export default config;
