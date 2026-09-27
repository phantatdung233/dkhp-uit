# UIT Schedule Planner

A modern web application designed for UIT (University of Information Technology - VNUHCM) students to plan, optimize, and resolve conflicts for course registration timetables.

## ✨ Features

- **Flexible Data Import**: Load schedules directly from Excel files (`.xlsx`, `.xls`) or synchronize via public Google Sheets.
- **Interactive Calendar Grid**: Visual weekly timetable view with drag-and-drop support and slot inspection.
- **Conflict Detection**: Real-time detection of overlapping periods/dates and theory-practical class pair validation.
- **Auto Scheduler**: Automatically generates non-conflicting timetable combinations based on selected courses.
- **Multi-Plan Management**: Create, rename, clone, and switch between multiple schedule drafts (persisted locally).
- **Credit Tracking**: Monitors theory and practical credits with alerts adhering to UIT academic limits (14–24 credits standard, GPA > 8.0 for 25–30 credits).
- **Export & Share**: Export high-resolution timetable images (download or copy to clipboard) and extract class code lists for fast registration.
- **Professor Reviews**: Look up student feedback and ratings for instructors before selecting classes.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router), React 18, TypeScript
- **State Management**: Zustand (LocalStorage persistence)
- **UI & Styling**: Tailwind CSS, Radix UI Primitives, Lucide Icons
- **Data & Utilities**: SheetJS (`xlsx`), `@dnd-kit`, `html-to-image`, Sonner

## 🚀 Getting Started

### Prerequisites

- Node.js 18.17+

### Installation & Run

```bash
# Clone repository
git clone https://github.com/phantatdung233/dkhp-uit.git
cd dkhp-uit

# Install dependencies
npm install

# Start development server at http://localhost:3000
npm run dev

# Build for production
npm run build
npm run start
```

## 📦 Utility Scripts

- `node scripts/excel-to-json.js <input.xlsx> [output.json]`: Converts raw UIT timetable Excel files into structured JSON.
- `node scripts/crawl-professor-reviews.js`: Scrapes and aggregates instructor reviews.

## 📄 License

Created for the UIT student community.
