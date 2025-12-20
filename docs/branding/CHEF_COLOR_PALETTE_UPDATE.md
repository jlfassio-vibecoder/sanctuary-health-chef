# Chef App Color Palette Update Guide

## Overview

This guide provides instructions for updating the Sanctuary Health Chef app's color palette to match the Trainer app's custom gold color scheme (`#f0dc7a`).

## Color Palette

### Primary Colors

- **Main Gold**: `#f0dc7a` - Primary brand color for buttons, highlights, and accents
- **Light Gold (Hover)**: `#f4e59c` - Lighter shade for hover states
- **Medium Gold**: `#e6d185` - Medium shade for gradients and transitions

### Darker Gold Shades (for shadows, borders, and gradients)

- **Dark Gold 1**: `#d4c469` - Darker shade for gradient endpoints
- **Dark Gold 2**: `#b8a85e` - For borders and subtle accents
- **Dark Gold 3**: `#9c8c53` - For darker borders
- **Dark Gold 4**: `#807048` - For shadows and dark backgrounds
- **Dark Gold 5**: `#6b5d3c` - Darkest shade for deep shadows

### Light Gold Shades (for backgrounds and subtle highlights)

- **Light Gold 1**: `#faf5e1` - Very light background tint
- **Light Gold 2**: `#fdfaf0` - Lightest background tint

## Migration Steps

### Step 1: Identify Current Color Usage

Search for color references in the Chef app:

```bash
# Search for common color class patterns
grep -r "lime-\|amber-\|yellow-\|green-" components/ src/ --include="*.tsx" --include="*.ts" --include="*.css"
```

Common patterns to look for:
- `lime-500`, `lime-400`, `lime-300`, `lime-900`, etc.
- `amber-500`, `amber-400`, `amber-300`, `amber-900`, etc.
- `yellow-500`, `yellow-600`, `yellow-900`, etc.
- `green-500`, `green-600`, `green-900`, etc. (if used for brand colors)

### Step 2: Replace Color Classes

#### Option A: Using Tailwind Arbitrary Values (Recommended)

Replace Tailwind color classes with arbitrary hex values:

**Background Colors:**
- `bg-lime-500` → `bg-[#f0dc7a]`
- `bg-amber-500` → `bg-[#f0dc7a]`
- `bg-yellow-500` → `bg-[#f0dc7a]`
- `bg-green-500` → `bg-[#f0dc7a]` (if used for brand)
- `bg-lime-400` → `bg-[#f0dc7a]` (or `bg-[#f4e59c]` for lighter)
- `bg-amber-400` → `bg-[#f0dc7a]` (or `bg-[#f4e59c]` for lighter)

**Text Colors:**
- `text-lime-500` → `text-[#f0dc7a]`
- `text-amber-500` → `text-[#f0dc7a]`
- `text-lime-400` → `text-[#f0dc7a]`
- `text-amber-400` → `text-[#f0dc7a]`
- `text-green-500` → `text-[#f0dc7a]` (if used for brand)

**Border Colors:**
- `border-lime-500` → `border-[#f0dc7a]`
- `border-amber-500` → `border-[#f0dc7a]`
- `border-lime-800` → `border-[#9c8c53]`
- `border-amber-800` → `border-[#9c8c53]`
- `border-green-500` → `border-[#f0dc7a]` (if used for brand)

**Hover States:**
- `hover:bg-lime-400` → `hover:bg-[#f4e59c]`
- `hover:bg-amber-400` → `hover:bg-[#f4e59c]`
- `hover:text-lime-400` → `hover:text-[#f4e59c]`
- `hover:text-amber-400` → `hover:text-[#f4e59c]`
- `hover:border-lime-500` → `hover:border-[#f0dc7a]`
- `hover:border-amber-500` → `hover:border-[#f0dc7a]`

**Gradients:**
- `from-lime-500 to-green-600` → `from-[#f0dc7a] to-[#d4c469]`
- `from-amber-500 to-yellow-600` → `from-[#f0dc7a] to-[#d4c469]`
- `from-lime-900 to-green-900` → `from-[#807048] to-[#6b5d3c]`
- `from-amber-900 to-yellow-900` → `from-[#807048] to-[#6b5d3c]`

**Shadows:**
- `shadow-lime-900/50` → `shadow-[#807048]/50`
- `shadow-amber-900/50` → `shadow-[#807048]/50`
- `shadow-green-900/50` → `shadow-[#807048]/50` (if used for brand)

**Opacity Variants:**
- `bg-lime-500/10` → `bg-[#f0dc7a]/10`
- `bg-amber-500/10` → `bg-[#f0dc7a]/10`
- `border-lime-500/50` → `border-[#f0dc7a]/50`
- `border-amber-500/50` → `border-[#f0dc7a]/50`

#### Option B: Using CSS Variables (Alternative)

If you prefer using CSS variables, add this to your main CSS file:

```css
:root {
  --gold-50: #fdfaf0;
  --gold-100: #faf5e1;
  --gold-200: #f5ebc3;
  --gold-300: #f0dc7a;
  --gold-400: #f4e59c;
  --gold-500: #f0dc7a;
  --gold-600: #d4c469;
  --gold-700: #b8a85e;
  --gold-800: #9c8c53;
  --gold-900: #807048;
  --gold-950: #6b5d3c;
}
```

Then use: `bg-[var(--gold-500)]`, `text-[var(--gold-500)]`, etc.

### Step 3: Automated Replacement Script

You can use this script to automate the replacement (run from Chef app root):

```bash
#!/bin/bash

# Navigate to Chef app directory
cd "/path/to/Sanctuary Health Chef"

# Replace background colors
find . -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -exec sed -i '' \
  -e 's/bg-lime-500/bg-[#f0dc7a]/g' \
  -e 's/bg-amber-500/bg-[#f0dc7a]/g' \
  -e 's/bg-yellow-500/bg-[#f0dc7a]/g' \
  -e 's/bg-green-500/bg-[#f0dc7a]/g' \
  -e 's/bg-lime-400/bg-[#f4e59c]/g' \
  -e 's/bg-amber-400/bg-[#f4e59c]/g' \
  {} \;

# Replace text colors
find . -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -exec sed -i '' \
  -e 's/text-lime-500/text-[#f0dc7a]/g' \
  -e 's/text-amber-500/text-[#f0dc7a]/g' \
  -e 's/text-lime-400/text-[#f0dc7a]/g' \
  -e 's/text-amber-400/text-[#f0dc7a]/g' \
  -e 's/text-green-500/text-[#f0dc7a]/g' \
  {} \;

# Replace border colors
find . -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -exec sed -i '' \
  -e 's/border-lime-500/border-[#f0dc7a]/g' \
  -e 's/border-amber-500/border-[#f0dc7a]/g' \
  -e 's/border-lime-800/border-[#9c8c53]/g' \
  -e 's/border-amber-800/border-[#9c8c53]/g' \
  -e 's/border-green-500/border-[#f0dc7a]/g' \
  {} \;

# Replace hover states
find . -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -exec sed -i '' \
  -e 's/hover:bg-lime-400/hover:bg-[#f4e59c]/g' \
  -e 's/hover:bg-amber-400/hover:bg-[#f4e59c]/g' \
  -e 's/hover:text-lime-400/hover:text-[#f4e59c]/g' \
  -e 's/hover:text-amber-400/hover:text-[#f4e59c]/g' \
  {} \;

# Replace gradients
find . -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -exec sed -i '' \
  -e 's/from-lime-500 to-green-600/from-[#f0dc7a] to-[#d4c469]/g' \
  -e 's/from-amber-500 to-yellow-600/from-[#f0dc7a] to-[#d4c469]/g' \
  -e 's/from-lime-900 to-green-900/from-[#807048] to-[#6b5d3c]/g' \
  -e 's/from-amber-900 to-yellow-900/from-[#807048] to-[#6b5d3c]/g' \
  {} \;

# Replace shadows
find . -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -exec sed -i '' \
  -e 's/shadow-lime-900/shadow-[#807048]/g' \
  -e 's/shadow-amber-900/shadow-[#807048]/g' \
  -e 's/shadow-green-900/shadow-[#807048]/g' \
  {} \;

echo "✅ Color replacement complete!"
```

**Note:** Review changes after running the script, as some replacements may need manual adjustment.

### Step 4: Common Component Updates

#### Buttons
```tsx
// Before
<button className="bg-lime-500 hover:bg-lime-400 text-slate-900">
  Click Me
</button>

// After
<button className="bg-[#f0dc7a] hover:bg-[#f4e59c] text-slate-900">
  Click Me
</button>
```

#### Text Highlights
```tsx
// Before
<span className="text-lime-400">Sanctuary</span> Health

// After
<span className="text-[#f0dc7a]">Sanctuary</span> Health
```

#### Borders and Focus States
```tsx
// Before
<input className="border-slate-700 focus:border-lime-500" />

// After
<input className="border-slate-700 focus:border-[#f0dc7a]" />
```

#### Gradients
```tsx
// Before
<div className="bg-gradient-to-r from-lime-500 to-green-600">

// After
<div className="bg-gradient-to-r from-[#f0dc7a] to-[#d4c469]">
```

#### Icons and Logo Backgrounds
```tsx
// Before
<div className="bg-lime-500 p-2 rounded-lg">
  <ChefHat className="text-slate-900" />
</div>

// After
<div className="bg-[#f0dc7a] p-2 rounded-lg">
  <ChefHat className="text-slate-900" />
</div>
```

### Step 5: Verify Changes

1. **Visual Check:**
   - Start the dev server: `npm run dev`
   - Navigate through all pages and components
   - Verify all gold colors match the Trainer app
   - Check buttons, links, icons, and accent elements

2. **Search for Remaining Old Colors:**
   ```bash
   grep -r "lime-\|amber-\|yellow-" components/ src/ --include="*.tsx" --include="*.ts" | grep -v "#f0dc7a\|#f4e59c"
   ```

3. **Build Test:**
   ```bash
   npm run build
   ```
   Ensure the build completes without errors.

4. **Cross-App Consistency:**
   - Compare visual appearance with Trainer app
   - Verify hover states match
   - Check that focus states use gold colors
   - Ensure gradients use the gold palette

### Step 6: Update Brand Assets (if applicable)

If you have any brand assets (logos, icons, images) that use the old green/amber color:
- Update SVG fill colors to `#f0dc7a`
- Update any image assets that contain the old color scheme
- Update favicon if it contains brand colors
- Update any ChefHat or food-related icons to use gold

## Color Reference Table

| Use Case | Old Color | New Color | Tailwind Class |
|----------|-----------|-----------|----------------|
| Primary buttons | `lime-500` / `amber-500` / `green-500` | `#f0dc7a` | `bg-[#f0dc7a]` |
| Hover states | `lime-400` / `amber-400` | `#f4e59c` | `hover:bg-[#f4e59c]` |
| Text highlights | `lime-400` / `amber-400` | `#f0dc7a` | `text-[#f0dc7a]` |
| Borders | `lime-500` / `amber-500` | `#f0dc7a` | `border-[#f0dc7a]` |
| Dark borders | `lime-800` / `amber-800` | `#9c8c53` | `border-[#9c8c53]` |
| Shadows | `lime-900` / `amber-900` | `#807048` | `shadow-[#807048]` |
| Gradient start | `lime-500` / `amber-500` | `#f0dc7a` | `from-[#f0dc7a]` |
| Gradient end | `green-600` / `yellow-600` | `#d4c469` | `to-[#d4c469]` |
| Dark gradient start | `lime-900` / `amber-900` | `#807048` | `from-[#807048]` |
| Dark gradient end | `green-900` / `yellow-900` | `#6b5d3c` | `to-[#6b5d3c]` |

## Testing Checklist

- [ ] All buttons use the new gold color (`#f0dc7a`)
- [ ] Hover states use lighter gold (`#f4e59c`)
- [ ] Text highlights use main gold (`#f0dc7a`)
- [ ] Borders and focus states use gold colors
- [ ] Gradients use gold color scheme
- [ ] Shadows use dark gold shades (`#807048`)
- [ ] Icons and logo backgrounds use gold
- [ ] No old green/amber/yellow colors remain (except for non-brand uses like food categories)
- [ ] Build completes successfully
- [ ] Visual consistency with Trainer app verified
- [ ] All interactive elements (links, buttons, inputs) have proper gold accents

## Important Notes

### Preserve Non-Brand Colors

**DO NOT** replace colors that are used for non-brand purposes:
- Food category colors (e.g., vegetables = green, fruits = various colors)
- Status indicators (e.g., success = green, error = red)
- Nutritional information colors (if using color coding)
- Ingredient type colors (if using color coding)

Only replace colors that are part of the **brand identity** (buttons, links, logos, accents, borders, shadows).

### Chef App Specific Considerations

- **ChefHat icon**: Should use gold background (`bg-[#f0dc7a]`)
- **Recipe cards**: Accent colors should use gold
- **Navigation**: Active states should use gold
- **Form inputs**: Focus borders should use gold
- **Call-to-action buttons**: Should use gold with hover states

## Support

If you encounter issues during the migration:
1. Check the Trainer app's components for reference implementations
2. Verify Tailwind version supports arbitrary values (v3.0+)
3. Review browser console for any CSS errors
4. Test in both light and dark modes if applicable
5. Compare with Hub app if it has already been updated

## Related Documentation

- [Trainer App Color Implementation](../HUB_COLOR_PALETTE_UPDATE.md) - Reference for Trainer app colors
- [Hub App Color Update Guide](../HUB_COLOR_PALETTE_UPDATE.md) - Similar guide for Hub app
- [Chef Firebase Migration Guide](./CHEF_FIREBASE_MIGRATION_GUIDE.md) - Complete migration guide

