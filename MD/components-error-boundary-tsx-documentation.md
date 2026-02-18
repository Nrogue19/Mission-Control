# components/ErrorBoundary.tsx Documentation

## File
`/src/components/ErrorBoundary.tsx`

## Purpose
React Error Boundary component that catches JavaScript errors in child components, preventing the entire app from crashing.

## Key Features
- Catches render errors in child components
- Displays fallback UI when errors occur
- Provides "Try Again" button to reset error state
- Logs errors to console for debugging
- Customizable component name for better error messages
- Dark mode support

## Usage
```jsx
import { ErrorBoundary } from './components/ErrorBoundary';

<ErrorBoundary componentName="TokenMonitor">
  <TokenUsageMonitor />
</ErrorBoundary>
```

## Props
- `children` - Child components to wrap
- `fallback` - Custom fallback UI (optional)
- `componentName` - Name for error logging (optional)

## Props
```typescript
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}
```

## Related Files
- `ErrorBoundary.css` - Error boundary styles
- `MonitoringComponents.jsx` - Components that can be wrapped
