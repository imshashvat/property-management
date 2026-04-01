# Property Management System (Vercel Ready)

A comprehensive, full-stack Property Management System built with **Next.js 14**, **TypeScript**, and **PostgreSQL**. This platform provides a cohesive interface for administrators to manage properties and tenants, and for tenants to manage their rentals, payments, and maintenance requests.

---

## 🚀 Easy Vercel Deployment

This project is optimized for deployment on Vercel.

### 1. Push to GitHub
If you haven't already, push these changes to your GitHub repository.

### 2. Import to Vercel
- Go to the [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New > Project**.
- Select your repository.

### 3. Setup Database (The Easy Way)
- In your Vercel Project Dashboard, click the **Storage** tab.
- Click **Create Database** and select **Postgres**.
- Follow the prompts to create the database.
- Once created, click **Connect** to link it to your project. This will automatically add the `DATABASE_URL` environment variable.

### 4. Add JWT Secret
- Go to **Settings > Environment Variables**.
- Add `JWT_SECRET` with any random string (e.g., `pms-secret-2024`).
- Add `JWT_REFRESH_SECRET` with another random string.

### 5. Redeploy
- Go to the **Deployments** tab and click **Redeploy**. Your project will now be live with a working database!

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Database:** [PostgreSQL](https://www.postgresql.org/) (Compatible with Vercel Postgres)
- **ORM:** [Prisma](https://www.prisma.io/)
- **Styling:** Vanilla CSS (Modern design)
- **Authentication:** Custom JWT-based authentication
- **Data Visualization:** Chart.js

---

## ⚙️ Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file at the root:
```env
DATABASE_URL="postgres://user:password@localhost:5432/pms"
JWT_SECRET="your-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
```

### 3. Database Setup
```bash
npx prisma generate
npx prisma db push
```

### 4. Running the Application
```bash
npm run dev
```

---

## 📂 Project Structure

- `src/app/` - Next.js App Router (Pages, API Routes, Layouts)
- `src/lib/` - Shared utilities, Auth logic, Prisma client
- `prisma/` - Database schema (`schema.prisma`) and seeding scripts

---

## 📄 License
This project is licensed under the MIT License.