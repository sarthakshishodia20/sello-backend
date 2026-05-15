# 🚀 Sello — Mini Clone

A full-stack merchant platform (Yelo mini-clone) with:
- **Admin (MasterMerchant)** + **Merchant** dual-role authentication
- **Category & Product CRUD** with image uploads
- **AI-powered product descriptions** (OpenAI)
- **Customer Webapp** with cart + Cash on Delivery checkout
- **Dark-mode, responsive UI** across dashboard and webapp

---

## 📁 Project Structure

```
workspace/
├── sello-backend/          # Node.js/Express API server (port 4000)
└── sello-frontend/
    ├── dashboard/          # Merchant/Admin dashboard (port 5173)
    └── webapp/             # Customer-facing webapp (port 5174)
```

---

## ⚙️ Quick Setup

### 1. Configure MySQL Password

Edit `sello-backend/.env`:
```env
DB_PASSWORD=your_mysql_password
```

### 2. Create Database & Run Schema

```bash
# Option A: with password
mysql -u root -p sello_db < sello-backend/database/schema.sql

# Option B: interactive
mysql -u root -p
> source /path/to/workspace/sello-backend/database/schema.sql
```

### 3. (Optional) Add OpenAI Key for AI descriptions

Edit `sello-backend/.env`:
```env
OPENAI_API_KEY=sk-your-key-here
```

### 4. Start Everything

**Terminal 1 — Backend:**
```bash
cd sello-backend
npm run dev
# → http://localhost:4000
```

**Terminal 2 — Dashboard:**
```bash
cd sello-frontend/dashboard
npm run dev
# → http://localhost:5173
```

**Terminal 3 — Webapp:**
```bash
cd sello-frontend/webapp
npm run dev
# → http://localhost:5174
```

---

## 🔑 Default Admin Login

```
Email:    admin@sello.com
Password: Admin@123
```

---

## 🌐 URLs

| App       | URL                        |
|-----------|---------------------------|
| Backend   | http://localhost:4000      |
| Health    | http://localhost:4000/health |
| Dashboard | http://localhost:5173      |
| Webapp    | http://localhost:5174      |

---

## 📡 API Endpoints

| Method | Path                              | Auth     | Description             |
|--------|-----------------------------------|----------|-------------------------|
| POST   | /api/auth/admin/login             | Public   | Admin login             |
| POST   | /api/auth/merchant/login          | Public   | Merchant login          |
| POST   | /api/auth/merchant/signup         | Public   | Register merchant       |
| GET    | /api/auth/profile                 | Any      | Get profile             |
| GET    | /api/catalog/categories           | Any      | List categories         |
| POST   | /api/catalog/categories           | Merchant | Create category         |
| PUT    | /api/catalog/categories/:id       | Merchant | Update category         |
| DELETE | /api/catalog/categories/:id       | Merchant | Delete category         |
| GET    | /api/products                     | Any      | List products           |
| POST   | /api/products                     | Merchant | Create product          |
| PUT    | /api/products/:id                 | Merchant | Update product          |
| DELETE | /api/products/:id                 | Merchant | Delete product          |
| POST   | /api/products/generate-description| Merchant | AI description          |
| POST   | /api/orders/place                 | Public   | Place order (COD)       |
| GET    | /api/orders                       | Merchant | List orders             |
| PUT    | /api/orders/:id/status            | Merchant | Update order status     |
| GET    | /api/orders/stats                 | Merchant | Dashboard stats         |
| GET    | /api/merchants                    | Admin    | List all merchants      |
| PUT    | /api/merchants/:id/status         | Admin    | Toggle merchant status  |
| GET    | /api/webapp/stores                | Public   | List stores (webapp)    |
| GET    | /api/webapp/stores/:slug          | Public   | Get store details       |
| GET    | /api/webapp/stores/:slug/products | Public   | Get store products      |

---

## 🎨 Design System

- **Dark mode first** — `#0f0f13` base, `#1a1a23` surface
- **Violet accent** `#7c5ef0` + **Teal** `#4fd1c5`  
- **Inter** font family
- Glassmorphism modals, micro-animations
- Responsive — mobile-friendly sidebar (collapsible), product grid

---

## 💡 Features

### Dashboard
- ✅ Admin & Merchant login (separate modes on same page)
- ✅ Merchant signup
- ✅ Collapsible sidebar with role-based navigation
- ✅ Dashboard stats (orders, revenue)
- ✅ Categories CRUD with image upload
- ✅ Products CRUD with image upload + AI description
- ✅ Orders management with status updates
- ✅ Merchants page (admin only) with search + toggle
- ✅ Store profile page with logo upload
- ✅ "Go to Webapp" button linking to merchant's store

### Webapp
- ✅ Store listing page with hero
- ✅ Individual store page with category filter
- ✅ Product grid with add to cart
- ✅ Sliding cart drawer with quantity controls
- ✅ Checkout page (Cash on Delivery only)
- ✅ Order success page with order number
