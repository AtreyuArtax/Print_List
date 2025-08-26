# Print a List (Quadrant Layout)

**Print a List** is a web application for quickly formatting and printing grocery or checklist-style lists in a clean, quadrant-based layout. Paste your list (supports Markdown checklists and simple bullets), and the app automatically organizes your items into four printable quadrants, complete with matching icons for common grocery items.

Access at https://atreyuartax.github.io/Print_List/

## Features

- **Markdown & Custom List Support:** Paste lists using GitHub-style checkboxes (`- [ ]`/`- [x]`), simple bullets, or your own `✓`/`◦` style.
- **Automatic Quadrant Packing:** Items are intelligently distributed across four quadrants to fit a standard letter page for easy folding and organization.
- **Grocery Icons:** Recognizes hundreds of grocery items and displays matching icons next to each item. Synonyms and plural forms are handled automatically.
- **Customizable Text Size:** Choose from small, normal, large, or extra-large text for optimal readability.
- **PDF Export:** Instantly generate a print-ready PDF snapshot of your list, matching the on-screen layout.
- **Responsive & Print-Optimized:** Looks great on screen and prints perfectly with browser print or PDF export.

## How It Works

1. **Paste Your List:** Enter your grocery or checklist in the textarea. The app supports Markdown checkboxes, simple bullets, and custom symbols.
2. **Automatic Formatting:** The app parses your list, removes checked/completed items, and organizes the rest into sections and quadrants.
3. **Icon Matching:** Each item is matched to a relevant grocery icon using a smart matching algorithm and a customizable synonym map.
4. **Print or Export:** Click "Print PDF" to generate a PDF, or use your browser's print dialog for a physical copy.

## Apple Notes & Reminders Integration

This application was specifically designed to support importing lists directly from **Apple Notes** or **Apple Reminders**. Using a custom Apple Shortcut, you can quickly export your shopping or task lists and paste them into the app. The list is then automatically formatted and enhanced with matching images for each item.

This feature makes it easy for parents and educators to create **visual shopping lists for children**, helping them participate in shopping by matching items with their corresponding icons. The visual cues support early readers and make shopping more engaging and accessible.

## File Structure

- `index.html` — Main HTML page and UI.
- `main.js` — Core logic: parsing, icon matching, quadrant layout, rendering, and PDF export.
- `styles.css` — Styles for screen and print layouts.
- `icon-map.json` — Synonym map for icon matching.
- `assets/` — Folder containing PNG icons for grocery items.
- `sample.md` — Example grocery list for demonstration.


## Usage

1. Open `index.html` in your browser.
2. Paste or type your list into the textarea.
3. Adjust text size as needed.
4. Click "Print PDF" to export, or print directly from your browser.

## Customization

- **Add Icons:** Place new PNG icons in the `assets/` folder. Name them using underscores (e.g., `peanut_butter.png`).
- **Edit Synonyms:** Update `icon-map.json` to add or change synonyms for icon matching.
- **Change Styles:** Edit `styles.css` for layout or color tweaks.

## License

MIT License

---

Made for quick, beautiful grocery and checklist
