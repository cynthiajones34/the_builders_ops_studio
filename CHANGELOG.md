# Changelog

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
