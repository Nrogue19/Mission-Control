# TypeScript Configuration

## File
`/tsconfig.json`

## Purpose
TypeScript compiler configuration for the project.

## Key Settings
- `target: ES2020` - ECMAScript target version
- `jsx: react-jsx` - React JSX transform
- `allowJs: true` - Allow JavaScript files
- `strict: false` - Less strict type checking (for React Scripts compatibility)
- `baseUrl: src` - Base directory for module resolution

## Related Files
- `src/components/*.tsx` - TypeScript components
- `package.json` - Dependencies

## Notes
Created to support TypeScript adoption. Components can be gradually migrated from .jsx to .tsx.
