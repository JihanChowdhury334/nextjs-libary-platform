// Resolves the "@/..." path alias from tsconfig.json for the Node test runner,
// which reads tsconfig for nothing. Registered via --import.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/alias-hooks.mjs", pathToFileURL("./"));
