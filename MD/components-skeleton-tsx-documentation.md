# components/Skeleton.tsx Documentation

## File
`/src/components/Skeleton.tsx`

## Purpose
Reusable skeleton loading components for better UX during data loading.

## Key Components

### Skeleton
Base skeleton component with customizable dimensions.
- `width` - Skeleton width (default: '100%')
- `height` - Skeleton height (default: '20px')
- `borderRadius` - Border radius (default: '4px')
- `className` - Additional CSS classes

### SkeletonCard
Pre-built skeleton for card content.

### SkeletonText
Multi-line text skeleton.
- `lines` - Number of text lines (default: 3)

### SkeletonAvatar
Circular avatar skeleton.
- `size` - Avatar size (default: '40px')

### SkeletonButton
Button-shaped skeleton.

## Features
- Animated shimmer effect
- Dark mode support
- Customizable dimensions
- CSS animations (no JS required)

## Related Files
- `Skeleton.css` - Skeleton styles
- `MissionControl.jsx` - Used for loading states
