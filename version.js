// The version of Triangle Thing and what changed in each one. The page and the changelog button both read this one file.
// To release: add an entry to the top of `changelog`, set `version` to match, and raise the ?v=N on its <script> tag in index.html.
// Keep ONE entry per day, and each entry to ONE short, simple sentence: if today already has an entry, add to its sentence instead of a new entry.
window.__TRIANGLE = {
  version: '1.5.1',
  changelog: [
    { v: '1.5.1', date: '2026-10-22', title: 'Checks and fixes', items: ['Trig near 90° is fixed, labels stay on screen, and the app now works with a keyboard.'] },
    { v: '1.5.0', date: '2026-10-21', title: 'Homework helper', items: ['A new Solve & Practice panel solves any triangle and gives homework-style problems with instant checking.'] },
    { v: '1.4.2', date: '2026-10-20', title: 'A real app on your phone', items: ['On a phone the page is now an app, and the maths is checked a second way after every change.'] },
    { v: '1.2.0', date: '2026-10-16', title: 'Dev mode and a lighter theme', items: ['Dev mode tests every control, and the fonts and icons are now served from the site itself.'] },
    { v: '1.0.0', date: '2026-09-27', title: 'The triangle', items: ['Drag a triangle and read every side, angle, area, circle and center with the working shown.'] }
  ]
};
