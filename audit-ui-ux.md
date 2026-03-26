# UI/UX & SaaS Best Practices Audit

## 1. Visual Aesthetics & Theme Consistency (Color Scheme)

### Current State vs. SaaS Best Practices
- **Issue:** The `packages/ui` library utilizes Radix UI primitives and Tailwind CSS, but the specific color tokens are not centrally defined in a semantic way (e.g., `primary`, `muted`, `accent`, `destructive`).
- **Recommendation:** Implement a strict, semantic design token system in `tailwind.config.ts`.
  - Use a modern SaaS palette:
    - **Backgrounds:** `#FAFAFA` (Light) or `#09090B` (Dark).
    - **Primary Accent:** `#3B82F6` (Blue) or a sophisticated Indigo `#4F46E5`.
    - **Destructive Actions:** Soft red `#EF4444`.
    - **Typography:** `Inter` or `Geist` (sans-serif) for high legibility, with grayscales (e.g., `text-slate-900` for headings, `text-slate-500` for descriptions).

### Dark Mode Support
- **Issue:** Modern SaaS demands a robust Dark Mode. Relying solely on default Tailwind colors without `dark:` variants makes the app unusable for developers or night-mode users.
- **Recommendation:** Integrate `next-themes` and configure Tailwind with `darkMode: 'class'`. Wrap the Next.js layout in a `<ThemeProvider>` and ensure every component in `@cortex/ui` has a well-tested dark variant.

## 2. User Flow Optimization (Minimizing Clicks & Steps)

### Onboarding & The "Aha!" Moment
- **Issue:** The user signs up and lands on an empty dashboard. They must manually create folders, install the extension, and navigate away to test the app.
- **Recommendation:**
  1. **Empty States:** Provide a welcoming empty state with a "Get Started" checklist (e.g., "Install Extension", "Save your first highlight", "Try AI Auto-Draft").
  2. **Pre-populated Content:** Automatically generate a "Welcome to Cortex" folder containing dummy highlights and an interactive guide.
  3. **Contextual Tooltips:** Use the `@cortex/ui/tooltip` component to guide users through the Command Palette (`Ctrl+K`).

### The Command Palette (`@cortex/ui/command-palette`)
- **Issue:** Users might have to click through deeply nested folders to find a specific highlight.
- **Recommendation:** Elevate the Command Palette to act as a global "Omnibar". It should allow searching for tags, highlights, folders, and executing actions like "Create new tag" or "Change Theme" instantly, mimicking Superhuman or Linear.

## 3. Extension UX

### Capture Interaction
- **Issue:** Capturing a highlight via the extension involves selecting text, right-clicking (context menu), or using a shortcut (`Ctrl+Shift+S`). The user has to actively open a popup to organize the highlight.
- **Recommendation:**
  - Introduce an inline "Hover Menu" that appears near the cursor immediately upon selecting text.
  - Implement a transient "Toast Notification" inside the active webpage confirming the highlight is saved (e.g., "Saved to 'Research'"). Provide an "Undo" or "Edit" button right in the toast to prevent breaking flow.

## 4. Accessibility (a11y)

### Keyboard Navigation & Screen Readers
- **Issue:** Ensuring all custom UI components (modals, dropdowns) trap focus and are screen-reader friendly.
- **Recommendation:** Radix UI inherently handles most accessibility, but ensure proper `aria-labels` are added to icon-only buttons (like `Trash` or `Edit` icons). Ensure a visible focus ring (`focus-visible:ring-2`) across all interactive elements.

## 5. Modals vs. Slide-overs

### Information Density
- **Issue:** Creating/Editing folders or viewing AI results via a standard centered Modal (`Dialog`) can feel disruptive to the underlying context.
- **Recommendation:** Switch complex forms or deep-dive AI views (like "Devil's Advocate") to a right-aligned Slide-over (`Sheet` or Drawer). This allows the user to reference the dashboard underneath while interacting with the AI.
