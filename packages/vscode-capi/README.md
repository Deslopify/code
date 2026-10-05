# [@vscode/copilot-api](https://www.npmjs.com/package/@vscode/copilot-api)

A module used for interacting with the GitHub Copilot API.

## Installation

This package is not available on the npm registry. You must build it from source, or use the `@vscode/copilot-api` package instead.

## Development

### Building

The package is built using esbuild to create a single platform-neutral ESM module that works in both Node.js and web environments:

```bash
# Build for production (minified)
npm run build

# Build for development (unminified)
npm run build:dev
```

### Build Output

- `dist/index.js` - Platform-neutral ESM build
- `dist/index.d.ts` - TypeScript declarations

### Package Exports

The package is configured with a simplified ESM export structure:

```json
{
  "exports": {
    "import": "./dist/index.js",
    "types": "./dist/index.d.ts"
  }
}
```
