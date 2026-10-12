/*
 * tests/register.mjs — registers the TS resolution hook for the
 * test runner (see npm test → node --test --import ./tests/register.mjs).
 */

import { register } from "node:module";

register("./ts-loader.mjs", import.meta.url);
