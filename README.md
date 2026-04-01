# Property Management System (Prisma-Free & Vercel Ready)

A lightweight, full-stack Property Management System built with **Next.js 14**, **TypeScript**, and **PostgreSQL** using raw SQL queries for maximum performance and easy deployment.

---

## 🚀 Easy Vercel Deployment

This project is fully optimized for Vercel and does **not** requires Prisma generation steps.

### 1. Push to GitHub
Push these changes to your repository.

### 2. Import to Vercel
- Go to the [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New > Project**.
- Select your repository.

### 3. Setup Database
- Click the **Storage** tab in your project.
- Create a **Postgres** database and connect it. This adds `DATABASE_URL` automatically.

### 4. Setup Auth
- Add `JWT_SECRET` and `JWT_REFRESH_SECRET` to **Settings > Environment Variables**.

### 5. Deploy
The build will run automatically and your site will be live!

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL (Raw SQL via `pg`)
- **Language:** TypeScript
- **Styling:** Vanilla CSS
- **Authentication:** JWT-based
- **ID Generation:** `cuid`

---

## 📂 Project Structure

- `src/app/` - Pages and SQL API Routes
- `src/lib/db.ts` - PostgreSQL connection pool
- `src/lib/auth.ts` - Authentication logic

---

## ⚙️ Local Setup
1. `npm install`
2. Create `.env` with `DATABASE_URL`
3. `npm run dev`