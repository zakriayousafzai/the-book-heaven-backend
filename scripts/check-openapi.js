import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specPath = path.join(root, "docs", "openapi.yaml");
const document = YAML.parse(fs.readFileSync(specPath, "utf8"));

const fail = (message) => {
  throw new Error(`OpenAPI validation failed: ${message}`);
};

if (!document.openapi?.startsWith("3.")) {
  fail("the openapi version must be 3.x");
}
if (!document.info?.title || !document.info?.version) {
  fail("info.title and info.version are required");
}
if (!document.paths || Object.keys(document.paths).length === 0) {
  fail("at least one path is required");
}

const methods = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);
let operationCount = 0;

for (const [route, pathItem] of Object.entries(document.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!methods.has(method)) {
      continue;
    }

    operationCount += 1;

    if (!operation.responses || Object.keys(operation.responses).length === 0) {
      fail(`${method.toUpperCase()} ${route} has no responses`);
    }
    if (!operation.tags || operation.tags.length === 0) {
      fail(`${method.toUpperCase()} ${route} has no tags`);
    }
  }
}

const references = new Set();
const collectReferences = (value) => {
  if (Array.isArray(value)) {
    value.forEach(collectReferences);
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  if (typeof value.$ref === "string") {
    references.add(value.$ref);
  }
  Object.values(value).forEach(collectReferences);
};

collectReferences(document);

for (const reference of references) {
  if (!reference.startsWith("#/")) {
    continue;
  }

  const segments = reference
    .slice(2)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));

  let target = document;
  for (const segment of segments) {
    if (!target || typeof target !== "object" || !(segment in target)) {
      fail(`unresolved reference ${reference}`);
    }
    target = target[segment];
  }
}

console.log(
  `OpenAPI OK: ${operationCount} operations, ${references.size} references, ${Object.keys(document.paths).length} paths`,
);
