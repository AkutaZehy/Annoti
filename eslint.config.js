import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";
import vueParser from "vue-eslint-parser";

export default defineConfig([
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts,vue}"],
        plugins: { js },
        extends: ["js/recommended"],
        languageOptions: { globals: { ...globals.browser, ...globals.node } },
    },
    { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
    tseslint.configs.recommended,
    // 忽略类型声明文件中的特定规则（这些规则对 .d.ts 文件不适用）
    {
        files: ["**/*.d.ts"],
        rules: {
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-explicit-any": "off",
        },
    },
    {
        files: ["**/*.vue"],
        plugins: {
            vue: pluginVue,
        },
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                parser: tseslint.parser,
                ecmaVersion: 2022,
                sourceType: "module",
            },
        },
        rules: {
            // Vue 基础规则
            ...pluginVue.configs["flat/essential"].rules,
            // 禁用多词组件名称规则（与 ESLint 9 不完全兼容）
            "vue/multi-word-component-names": "off",
        },
    },
    {
        files: ["**/*.json"],
        plugins: { json },
        language: "json/json",
        extends: ["json/recommended"],
    },
    {
        files: ["**/*.md"],
        plugins: { markdown },
        language: "markdown/gfm",
        extends: ["markdown/recommended"],
    },
    // 禁用 CSS 文件检查（使用自定义 CSS 变量，ESLint CSS 解析器无法正确处理）
    { ignores: ["**/*.css"] },
    prettier,
]);
