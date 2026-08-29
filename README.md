# ZP Candidate Dashboard 📊

An interactive analytics dashboard for **Zila Parishad (ZP)** candidate tracking, seat reservations, and zone/district-wise bifurcation analysis.

## 🚀 Features

- **5 High-Level KPIs**:
  - Total ZP Seats
  - Seats with Candidates (>= 1)
  - Seats with 2+ Candidates (Multi-Candidate Seats)
  - Gap Seats (0 Candidates Identified)
  - Total Candidates Identified
- **Zone-wise & District-wise Bifurcation**:
  - Comparative breakdown across Champaran, Sahabad, Saran zones and all districts.
  - Interactive row click to drill down into any zone or district.
- **Seat-wise Candidate Directory**:
  - Numbered probable candidate tags (`1`, `2`, `3`, etc.).
  - Candidate count badges per seat (`4 Candidates`, `2 Candidates`, `1 Candidate`, `0 (Gap)`).
  - Search by ZP Seat Number (e.g. `Raxaul_1`) with autocomplete suggestions.
  - Multi-level filters: Candidate Status, Zone, District, PC, AC, Block, and Reservation Status.
- **Candidate Detail Modal**:
  - Full candidate profiles with contact info, category, caste, age, JS designation, recommendation source, brief profile, remarks, and PK feedback.
  - Previous/Next candidate navigation for multi-candidate seats.
  - District ZP Chairman indicators.
- **Live Google Sheet Sync**:
  - Automatically fetches and parses data directly from Google Sheets using SheetJS.

## 💻 Tech Stack

- **HTML5 & Vanilla CSS**: Modern dark-mode glassmorphic UI, responsive layouts, smooth micro-animations.
- **JavaScript (ES6+)**: Dynamic filtering, KPI counters, modal views, and search suggestions.
- **SheetJS (xlsx)**: Client-side XLSX parsing.

## 🌐 Live Demo & Deployment

Open `index.html` directly in any web browser or host via **GitHub Pages**.
