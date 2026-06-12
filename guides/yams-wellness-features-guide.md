# Y.A.M.S. WELLNESS
## Website & Client Portal — Features & Functionality Guide

**Prepared for:** [Coach Name], Owner
**Sites:** yamswellness.com (public website) · portal.yamswellness.com (client portal)
**Last Updated:** June 2026

---

## OVERVIEW

The Y.A.M.S. Wellness platform is two connected applications built for your coaching practice:

1. **The public website** — tells your story, presents your four packages, and turns visitors into Vibe Check applicants.
2. **The client portal** — a secure, login-protected space where each client's coaching journey lives (intake, session prep, progress, resources, contracts), plus a private admin dashboard where you run the entire practice.

Every application, email notification, and client account flows between them automatically — no spreadsheets, no third-party booking apps, and no monthly software subscription.

---

## SECTION 1: THE PUBLIC WEBSITE

The public website has six pages your visitors see and use.

### 1.1 Home Page (index.html)

The front door to your practice. It speaks directly to your audience — high-achieving Black women ready to stop surviving and start living in alignment — and moves them toward one action: applying for a Vibe Check.

What it includes:
- **Hero** — "For the woman who has poured into everyone but herself," with an Apply call-to-action
- **"You know this feeling" section** — names the alignment problem your coaching solves
- **Packages grid** — all four coaching paths with pricing (see 1.2)
- **Testimonials** — real client words, real shifts
- **Email opt-in** — visitors get the free 5-Day Alignment Reset guide and join your list
- **Final call-to-action** — "Ready to stop pouring from an empty cup?"
- **Mobile-friendly navigation** throughout

### 1.2 Work With Me Page (work-with-me.html)

Full detail on every package, including what's included and who it's best for:

| Package | Format | Price |
|---|---|---|
| REVIVE | 3 × 60-minute sessions | $150 |
| RESTORE | 2 × 90-minute intensive sessions | $350 |
| REALIGN | 6-week program, weekly sessions | $2,000 |
| THE YAMS METHOD | 12-week signature transformation | $3,500 |
| Individual sessions | Single 60-minute session | $50 |

All packages include client portal access. The page closes with the four-step "From application to alignment" path: Apply → Connect → Begin → Transform.

### 1.3 About Page (about.html)

Your story — why you built Y.A.M.S. — plus the Focus → Reflect → Refine framework explained, your approach, and your credentials.

### 1.4 Apply Page (apply.html) — The Vibe Check Application

The heart of the public site. Prospective clients complete a short application:

- Name, email, phone, city
- How they heard about Y.A.M.S.
- Which package they're interested in (or "not sure yet")
- What's bringing them here right now
- What they want to be different 90 days from now

**What happens on submit:**
1. The application is saved to your database as a lead
2. The applicant instantly receives a branded confirmation email with a summary of what they shared
3. You receive a notification email with the full application
4. The lead appears in your admin Leads screen, ready to review

### 1.5 Contact Page (contact.html)

A simple form for general inquiries, media, and partnerships. Messages are saved to your admin inbox and emailed to you.

### 1.6 Terms Page (terms.html)

Your terms and conditions.

---

## SECTION 2: THE CLIENT PORTAL (what your clients see)

Each client logs in with their own account and sees only their own records. Seven pages:

### 2.1 Dashboard
A personal welcome with their journey at a glance — package, upcoming focus, and quick links to everything below.

### 2.2 Intake
The intake form they complete before the first session — their story, goals, and starting point. Saved to their record so you can review it any time.

### 2.3 Session Prep
Reflection prompts clients complete before each session, so every meeting starts with intention.

### 2.4 Progress
A running progress journal — clients log their shifts week by week, and you can add coach notes alongside.

### 2.5 Resources
Your curated resource library — practices, readings, and tools you publish from the admin. Clients can read; only you can add.

### 2.6 Contract
The client reviews their coaching agreement and signs it electronically, right in the portal. The signed contract is stored on their record.

### 2.7 Contact Coach
A direct message line to you between sessions. Messages land in your admin inbox and your email.

---

## SECTION 3: THE COACH ADMIN (password-protected, coach only)

Your private back office at the portal address. Protected by coach-only authentication — no client can ever access it.

### 3.1 Dashboard
A snapshot of the practice: active clients, new leads, upcoming sessions, and recent activity.

### 3.2 Leads
Every Vibe Check application in one pipeline. Filter by package, review the full application, and track status from new lead → call scheduled → enrolled.

### 3.3 Clients
The full roster. Click any client to open their complete record — intake, session history, progress entries, contracts, and profile.

### 3.4 Create Client Accounts
When an applicant becomes a client, you create their portal account directly from the admin — one click, credentials handled automatically.

### 3.5 Calendar
Your session schedule across all clients.

### 3.6 Contracts & Templates
Write your coaching agreement once as a reusable template using merge fields:
- `{{CLIENT_NAME}}`
- `{{PACKAGE}}`
- `{{DATE}}`

Send a contract to any client in seconds — the fields fill themselves. Signed contracts are stored on the client's record.

### 3.7 Financials
A payment log tied to clients and packages, so you always know what's been paid and what's outstanding.

### 3.8 Messages
Your inbox for client messages sent from the portal's Contact Coach page and the public contact form.

### 3.9 Reporting
Summaries of leads, enrollment, and revenue across the practice.

### 3.10 Resources
Publish and manage the shared resource library your clients see.

### 3.11 Status
A system health view confirming everything is running as expected.

---

## SECTION 4: AUTOMATED EMAIL NOTIFICATIONS

The right email goes out automatically at every step:

**When a Vibe Check application is submitted:**
- The applicant receives a branded confirmation summarizing what they shared and what happens next
- You receive a notification with the full application

**When a contact form message arrives:**
- The sender receives an acknowledgment
- You receive the message by email (and in your admin inbox)

**When you create a client account:**
- The new client receives their portal welcome and login details

**When you message a client from the admin:**
- The client receives your message by email

---

## SECTION 5: SECURITY

- Every client has their own login (Firebase Authentication)
- Database security rules guarantee each client can read and write **only their own records**
- The admin is locked to your account with a coach-only permission claim
- Resources are readable by logged-in clients but writable only by you
- Financials, leads, and templates are visible to you alone

---

## SECTION 6: TECHNOLOGY & HOSTING

For reference — you don't need to manage any of this day-to-day.

- **Hosting:** Firebase Hosting (Google) — both the website and the portal
- **Database:** Firebase Firestore — leads, clients, sessions, progress, contracts, messages, payments
- **Authentication:** Firebase Auth with a coach-only admin claim
- **Automated functions:** Firebase Cloud Functions — application pipeline, account creation, and all emails
- **Email delivery:** Gmail via secure app credentials
- **Domains:** yamswellness.com (website) · portal.yamswellness.com (portal)

---

## SECTION 7: QUICK REFERENCE — YOUR ROUTINE

**When a new application arrives (you'll get an email):**
- [ ] Open Admin → Leads and review the application
- [ ] If it's a fit, send the Vibe Check scheduling link
- [ ] After the call, create their client account from the admin

**When a new client enrolls:**
- [ ] Send their contract from a template (fields fill automatically)
- [ ] Confirm they've completed intake before session one

**Weekly:**
- [ ] Check Session Prep entries before each session
- [ ] Add session notes and progress entries after each session
- [ ] Log payments in Financials

**As needed:**
- [ ] Add new items to the Resources library
- [ ] Reply to portal messages from the Messages inbox
- [ ] Review Reporting for a practice-level view

---

*Questions? This guide describes the platform as deployed in June 2026.*
