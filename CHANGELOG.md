# Changelog

## 1.1.0.7 (2026-06-21)

- Mobile nav: the menu toggle now switches to an X (✕) while the menu is open and back to the hamburger (☰) when closed

## 1.1.0.6 (2026-06-21)

- Mobile: fix the navigation menu so all six links show full-screen. The nav's backdrop-filter was making it the containing block for the fixed menu overlay, trapping it inside the bar so the top links overflowed off-screen. Drop the blur on mobile (the 92%-opaque background covers for it).

## 1.1.0.5 (2026-06-21)

- Mobile: fix the hero stat bar cutting off the "183%" block by letting the three columns shrink (min-width:0) and trimming their padding and number size so all three fit

## 1.1.0.4 (2026-06-21)

- Mobile: center the hero buttons (a conflicting touch-target rule had left them inconsistently aligned)
- Mobile: show the full circular hero photo without cropping its sides (display the image at its natural aspect, contained and centered)
- Mobile: keep the footer copyright "Atlanta, GA" together on one line

## 1.1.0.3 (2026-06-18)

- Restore the trimmed footer that a prior squash-merge had reverted: remove the reintroduced logo, Contact link, and personal email; keep the Work link
- Replace remaining personal email references (structured data and contact-form fallback) with cynthia@thebuildersopsstudio.com

## 1.1.0.2 (2026-06-18)

- Change the homepage booking from an always-on inline embed to a "Book a Discovery Call" button that opens the Google Calendar booking page in a popup dialog
- Booking calendar lazy-loads on first open (no extra load on page view); dialog closes via button, click-outside, or Escape

## 1.1.0.1 (2026-06-18)

- Replace Calendly with an inline Google Calendar Appointment Scheduling embed on the homepage booking CTA (Google Meet, free times only)
- Remove the Calendly widget script and stylesheet from the page head

## 1.1.0.0 (2026-06-12)

- Add Work portfolio section to homepage with case-study cards
- Add animated case-study walkthrough: The Blessed Baker and Son (work/blessed-baker.html)
- Add animated case-study walkthrough: Y.A.M.S. Wellness (work/yams.html)
- Add YAMS features guide (markdown + PDF) in guides/
- Progressive-enhancement fallbacks (no-JS/no-IntersectionObserver), null-guarded demos, og:image + aria-label fixes from pre-landing review
