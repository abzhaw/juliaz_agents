---
name: framer-motion
description: Framer Motion animations, transitions, gesture handling in the Julia frontend. Use when adding animations to the Next.js dashboard.
---

# Framer Motion

## Setup (Next.js App Router)
```tsx
'use client';  // required — Framer Motion uses browser APIs
import { motion, AnimatePresence } from 'framer-motion';
```

## Basic Animations
```tsx
// Fade in + slide up
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3, ease: 'easeOut' }}
>
  Content
</motion.div>
```

## AnimatePresence (for mount/unmount)
```tsx
<AnimatePresence mode="wait">
  {isVisible && (
    <motion.div key="panel"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      Panel content
    </motion.div>
  )}
</AnimatePresence>
```

## Stagger Children (for lists)
```tsx
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } }
};
const item = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0 }
};

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map(i => <motion.li key={i.id} variants={item}>{i.name}</motion.li>)}
</motion.ul>
```

## Hover & Tap
```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: 'spring', stiffness: 400 }}
>
  Click me
</motion.button>
```

## Julia Dashboard Patterns
- Status indicators: pulse animation for "online" state
- Message list: stagger fade-in on new messages
- Page transitions: fade between views
- Loading skeletons: shimmer with `animate={{ opacity: [0.5, 1, 0.5] }}`
