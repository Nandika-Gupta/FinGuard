# Frontend Guidelines & Component Blueprint: FinGuard

## 1. Design Principles
- **Clarity over Chaos:** Fintech infrastructure can be visually overwhelming. Use plenty of white space and crisp layouts to maintain visual comfort.
- **Security-First UX:** Every user action should feel high-integrity. Input indicators, confirmation states, and clear warnings establish user trust.
- **Minimalist Aesthetic:** Inspired by modern developer platforms like Stripe and Plaid—combining neutral slate slate tones, clean borders, and vibrant visual accents.
- **Accessibility (WCAG 2.1 AA):** Ensure optimal text contrast ratios, standard elements, and robust touch targets.

---

## 2. Design Tokens

### Color Palette
- **Backgrounds:** Off-white (`bg-slate-50`) with pure white (`bg-white`) container bodies for light mode. Deep slate (`bg-[#0a0f1d]`) with dark containers (`bg-[#12192c]`) for standard dark styling.
- **Brand Accents:** FinGuard Navy (`#0f172a`), Brand Indigo (`#6366f1`), High-Risk Amber (`#f59e0b`), Critical Red (`#ef4444`), Success Emerald (`#10b981`).

### Typography Scale
- **Display Headings:** Space Grotesk or Outfits tracking-tight for modern digital layouts.
- **Body & Controls:** Inter (Clean, neutral weights).
- **Security/System Outputs:** JetBrains Mono for JWT codes, IP addresses, transaction hashes, and log files.

---

## 3. Tailwind CSS Core Component Prototypes

### Bulletproof Action Buttons
```html
<!-- Primary Action -->
<button class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:transform active:scale-[0.98] text-white text-sm font-medium rounded-lg shadow-sm transition-all duration-150 flex items-center gap-2">
  Execute Ledger Entry
</button>

<!-- Secondary Outline -->
<button class="px-4 py-2.5 bg-transparent border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors">
  Cancel Transaction
</button>
```

### High-Integrity Form Inputs
```html
<div class="space-y-1.5 Wadd-full">
  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Receiver Node Wallet Account</label>
  <input type="text" placeholder="FG-WL-90812-US" class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-slate-800 dark:text-slate-100 transition-shadow">
</div>
```

---

## 4. Animation Guidelines
- **Hover Micro-Interactions:** Subtle background opacity shifting or 1px vertical lift (`hover:-translate-y-0.5`).
- **Presence Transitions:** Utilize short `motion` fade-in controls (`opacity: 0` to `opacity: 1`) on route shifts and dashboard loads to avoid content jumps.
- **Alert Pulse States:** Fraud alerts and critical telemetries should feature slow, glowing pulses (`animate-pulse`) to signal prompt operator reviews.
