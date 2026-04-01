# Property Management System

A comprehensive, full-stack Property Management System built with Next.js 14, TypeScript, and Prisma. This platform provides a cohesive interface for administrators to manage properties and tenants, and for tenants to manage their rentals, payments, and maintenance requests.

---

## 🚀 Features

### 👨‍💼 Administrator Portal
- **Property & Unit Management:** Easily add and track properties, manage flats with detailed status (Occupied, Vacant, Under Maintenance).
- **Tenant Administration:** Oversee tenant profiles, assign flats, handle documentation, and track move-in dates.
- **Financial Dashboard:** Real-time visibility into payments, overdue rent, deposits, and automated late-fee tracking. Visualizations powered by Chart.js.
- **Maintenance Tracking:** Manage maintenance requests efficiently, assign priority, track resolution, and close tickets.
- **Automated Communication:** Send targeted announcements, email-like internal messages, and system notifications.
- **Visitor Management:** Track expected visitors, check-ins, and check-outs for security.
- **Audit Logging:** Built-in transparency with automated logging of administrative actions.

### 🏠 Tenant Portal
- **Intuitive Dashboard:** Quick access to active assignments, payment dues, and recent notifications.
- **Maintenance Requests:** Submit, categorize, and track repair and maintenance issues easily.
- **Payment Gateway:** View payment history, pending dues, and submit rent payments.
- **Communication:** Receive community announcements and direct messages regarding the property.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Database:** SQLite (development/local)
- **ORM:** [Prisma](https://www.prisma.io/)
- **Authentication:** Custom JWT-based authentication using `jose` & `bcryptjs`
- **UI & Icons:** [Lucide React](https://lucide.dev/), Tailwind CSS (Standard implementation)
- **Data Visualization:** Chart.js & react-chartjs-2

---

## ⚙️ Local Development Setup

Follow these instructions to get the project up and running on your local machine.

### Prerequisites
Make sure you have Node.js (v20+ recommended) installed.

### 1. Clone & Install Dependencies
Navigate to the project directory and install the required packages:
```bash
npm install
```

### 2. Environment Variables
Ensure you have a `.env` file at the root of the project. It should contain at least the database URL for Prisma.
```env
DATABASE_URL="file:./dev.db"
# Add other required variables (like JWT secret) here
```

### 3. Database Setup
Push the Prisma schema to your SQLite database to create the tables.
```bash
npm run db:push
```

*(Optional)* Seed the database with initial dummy data:
```bash
npm run db:seed
```

### 4. Running the Application
Start the Next.js development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

---

## 📦 Available Scripts

- `npm run dev` - Starts the development server.
- `npm run build` - Builds the application for production.
- `npm run start` - Runs the production build.
- `npm run lint` - Runs Next.js ESLint.
- `npm run db:push` - Synchronizes the Prisma schema with the database.
- `npm run db:seed` - Populates the database with initial seed data.
- `npm run db:studio` - Opens Prisma Studio for a web-based database UI.

---

## 📂 Project Structure

- `src/app/` - Next.js App Router (Pages, API Routes, Layouts)
- `src/lib/` - Shared utilities, Auth logic, Prisma client
- `prisma/` - Database schema (`schema.prisma`) and seeding scripts

---

## 📄 License
This project is licensed under the MIT License.