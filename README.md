# 🗺️ SquadMap — Real-Time Group Location & Driving ETA Tracker

> **Coordinate road trips, track live squad positions, and see driving ETAs on one shared map — without creating an account.**

[![GitHub Repository](https://img.shields.io/badge/GitHub-LEVELING2108%2FSquadMap-emerald?logo=github)](https://github.com/LEVELING2108/SquadMap.git)
[![Stack](https://img.shields.io/badge/Tech_Stack-Next.js_15_%7C_Express_%7C_tRPC_%7C_Prisma_7-black)](https://github.com/LEVELING2108/SquadMap.git)
[![UI Theme](https://img.shields.io/badge/Design-Light_Traveler_Stone-emerald)](#-design-aesthetics)

---

## 🌟 Key Features

* 🚗 **Real-Time Driving Road Polylines**: Renders smooth, color-coded driving road paths from each squad member to the destination pin powered by **OSRM (Open Source Routing Machine)**.
* 📍 **Zero-Friction Room Creation**: Host a trip in seconds and invite friends using a 6-character room code (e.g. `GOA-842`) or instant shareable link.
* 🔋 **Battery-Aware Adaptive GPS Engine**: Dynamically scales GPS update frequencies based on movement speed to save phone battery during long drives:
  * **Driving (>30 km/h)**: High precision updates every **5 seconds**.
  * **Moving (5–30 km/h)**: Balanced updates every **15 seconds**.
  * **Stationary (<5 km/h)**: Battery Saver mode every **45 seconds**.
* 🟢 **Member Connection & Staleness Badges**: Live connection status indicators (`Online 🟢`, `Idle 🟡`, `Seen Xm ago 🔴`) on traveler cards.
* 💬 **In-App Squad Chat Overlay**: Quick-reply chips (*"On my way! 🚗"*, *"Almost there 🏁"*) and real-time message stream.
* 🏁 **Auto "Arrived" Detection**: Automatically triggers a green arrival checkmark when a traveler gets within 100 meters of the destination.
* 🎨 **Minimal Traveler Theme**: Off-white mountain contour aesthetic (`bg-stone-50`) with spacious typography and zero dark-mode gradient clutter.

---

## 🏗️ Project Architecture

SquadMap is built as a high-performance TypeScript monorepo powered by **Turborepo**:

```
SquadMap/
├── apps/
│   ├── web/         # Web PWA & App Router (Next.js 15, TailwindCSS, Leaflet Map)
│   ├── server/      # Express API server & tRPC Endpoint Handler
│   └── native/      # Native Mobile Application (React Native, Expo)
└── packages/
    ├── api/         # tRPC router & business logic procedures (sessionRouter)
    ├── db/          # Prisma 7 ORM schema, PrismaPg adapter & DB proxy
    ├── env/         # Environment variable schemas & type validation
    └── ui/          # Shared UI primitives & design tokens
```

---

## 🛠️ Technology Stack

| Category | Technology |
| :--- | :--- |
| **Frontend Web** | Next.js 15 App Router, React 19, TailwindCSS |
| **Interactive Map** | Leaflet JS, OpenStreetMap Outdoor Tiles |
| **Driving Directions** | OSRM (Open Source Routing Machine) API |
| **API Layer** | tRPC v11, TanStack Query v5 |
| **Backend API** | Express.js, Node.js |
| **ORM & Database** | Prisma 7 ORM (`@prisma/adapter-pg`), PostgreSQL / Hybrid Proxy |
| **Native Mobile** | React Native 0.86, Expo 57, Expo Router |

---

## 🚀 Quick Start

### 1. Prerequisites
Make sure you have **Node.js v18+** installed.

### 2. Clone Repository
```bash
git clone https://github.com/LEVELING2108/SquadMap.git
cd SquadMap
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup
Generate the Prisma 7 client:
```bash
npm run db:generate
```

### 5. Run Local Development Server
Start the Web App and Backend Server in parallel:
```bash
npx turbo run dev -F web -F server
```

* **Web Application**: Open [http://localhost:3001](http://localhost:3001) in your browser.
* **Express Backend**: Running on [http://localhost:3000](http://localhost:3000).

---

## 📖 How to Use SquadMap

1. **Host a Trip**: Go to [http://localhost:3001](http://localhost:3001), enter your name and destination (e.g. *"Baga Beach"*), and tap **Create Trip Room**.
2. **Share Link**: Copy the trip room link or share the 6-character room code (e.g. `GOA-842`) with your squad.
3. **Track & Chat**: Watch member markers move along driving road polylines in real-time, view ETAs, and send quick chat updates!

---

## 📄 License & Repository

Created for real-time squad trip coordination. Tracked on GitHub:
👉 **[https://github.com/LEVELING2108/SquadMap.git](https://github.com/LEVELING2108/SquadMap.git)**
