# Chef Color Palette - Quick Reference

## Primary Gold Color
**Main Gold**: `#f0dc7a`

## Quick Replacements

| Find | Replace With |
|------|--------------|
| `bg-lime-500` | `bg-[#f0dc7a]` |
| `bg-amber-500` | `bg-[#f0dc7a]` |
| `bg-green-500` | `bg-[#f0dc7a]` (if brand color) |
| `text-lime-400` | `text-[#f0dc7a]` |
| `text-amber-400` | `text-[#f0dc7a]` |
| `hover:bg-lime-400` | `hover:bg-[#f4e59c]` |
| `hover:bg-amber-400` | `hover:bg-[#f4e59c]` |
| `border-lime-500` | `border-[#f0dc7a]` |
| `border-amber-500` | `border-[#f0dc7a]` |
| `from-lime-500 to-green-600` | `from-[#f0dc7a] to-[#d4c469]` |
| `from-amber-500 to-yellow-600` | `from-[#f0dc7a] to-[#d4c469]` |
| `shadow-lime-900` | `shadow-[#807048]` |
| `shadow-amber-900` | `shadow-[#807048]` |

## Color Palette

- **Main**: `#f0dc7a` - Buttons, highlights, primary elements
- **Hover**: `#f4e59c` - Hover states
- **Gradient End**: `#d4c469` - Gradient endpoints
- **Dark Border**: `#9c8c53` - Dark borders
- **Shadow**: `#807048` - Shadows
- **Darkest**: `#6b5d3c` - Deep shadows, dark gradients

## One-Line Search Command

```bash
grep -r "lime-\|amber-\|yellow-" components/ src/ --include="*.tsx" --include="*.ts"
```

**Note:** Only replace brand colors. Preserve non-brand colors (food categories, status indicators, etc.).

For detailed instructions, see [CHEF_COLOR_PALETTE_UPDATE.md](./CHEF_COLOR_PALETTE_UPDATE.md).

