// The version of Triangle Thing and what changed in each one. The page and the changelog button both read this one file.
// To release: add an entry to the top of `changelog`, set `version` to match, and raise the ?v=N on its <script> tag in index.html.
// Keep each version to three sentences at most.
window.__TRIANGLE = {
  version: '1.4.2',
  changelog: [
    { v: '1.4.2', date: '2026-10-20', title: 'Dev mode aims at problems', items: [
      'Dev mode has a new Aim at problems mode: it remembers what broke before, replays old problems, spends most of its time on the likeliest suspects, and shrinks each failure to its shortest recipe.',
      'Tests now run about ten times a second, and the calculation check line at the bottom of the sidebar is gone (the checks still run quietly in Dev mode).'
    ] },
    { v: '1.4.1', date: '2026-10-20', title: 'Tidier logo, steadier dev mode', items: [
      'The logo in the top-left corner is now on one line, like the one in Shop Tool Sim.',
      'Dev mode keeps running when the tab is in the background or another window is in front.'
    ] },
    { v: '1.4.0', date: '2026-10-20', title: 'A real app on your phone', items: [
      'On a phone the page becomes an app with a bottom tab bar (Triangle, Stats, Transform, Tools), slide-up sheets, and room for the notch and home bar.',
      'Touch works properly: bigger corner handles, pinch to zoom, two fingers to pan, and a double tap to fit the triangle. You can add it to your home screen.',
      'A What’s new button with this changelog, styled like the one in Shop Tool Sim.'
    ] },
    { v: '1.3.0', date: '2026-10-20', title: 'Checked maths, pivots and a new look', items: [
      'Every number in the sidebar is now re-worked a second way after each change and checked, and Dev mode reports any disagreement.',
      'New Transform panel for rotation, position and scale about any pivot you pick, and arrows that point overlapping labels at what they describe.',
      'The sidebar now looks like Shop Tool Sim’s, every icon has its own hover animation, and the logo is stacked Triangle over Thing.'
    ] },
    { v: '1.2.0', date: '2026-10-16', title: 'Dev mode and a lighter theme', items: [
      'Dev mode tests every control, in pairs, in combinations and in whole journeys, and grades how smoothly the page runs.',
      'Custom colors no longer force the whole page into one theme, and the fonts and icons are served from the site itself.'
    ] },
    { v: '1.0.0', date: '2026-09-27', title: 'The triangle', items: [
      'Drag any corner, side or the whole triangle and read every side, angle, area, circle, cevian and center, with the working shown for each.',
      'Lock any side or angle, type values with units, and switch between inches, millimeters and more.'
    ] }
  ]
};
