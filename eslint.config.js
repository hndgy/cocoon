import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allow intentional empty catch blocks used for "best effort" cleanup.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  // Disable formatting-related rules that Prettier owns.
  prettier,
);
