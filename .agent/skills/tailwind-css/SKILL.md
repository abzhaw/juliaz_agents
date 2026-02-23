---
name: tailwind-css
description: Tailwind utility classes, dark mode, responsive design, theming. Use when styling Julia's Next.js frontend dashboard.
---

# Tailwind CSS

## Core Concepts
```tsx
// Utility-first — classes describe what you want
<div className="flex items-center gap-4 p-6 rounded-xl bg-zinc-900 text-white">
  <span className="text-sm font-medium text-zinc-400">Status</span>
  <span className="text-green-400">● Online</span>
</div>
```

## Dark Mode
```tsx
// In tailwind.config.ts
export default { darkMode: 'class' }

// Usage
<div className="bg-white dark:bg-zinc-900 text-black dark:text-white">
```

## Responsive Design
```tsx
// Mobile-first breakpoints: sm(640), md(768), lg(1024), xl(1280)
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

## Julia Dashboard Design Tokens
```tsx
// Consistent color palette for the agent system
const colors = {
  online:   'text-emerald-400 bg-emerald-400/10',
  offline:  'text-zinc-500 bg-zinc-500/10',
  error:    'text-red-400 bg-red-400/10',
  warning:  'text-amber-400 bg-amber-400/10',
  surface:  'bg-zinc-900 border border-zinc-800',
  card:     'bg-zinc-800/50 rounded-xl p-4',
}
```

## Glassmorphism Effect
```tsx
<div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl">
```

## Animations (built-in)
```tsx
<div className="transition-all duration-300 hover:scale-105 hover:shadow-lg">
<div className="animate-pulse">  {/* loading skeleton */}
<div className="animate-spin">   {/* loader */}
```
