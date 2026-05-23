# 🛍️ Sello — Multi-Merchant Commerce Platform

> A full-stack, multi-merchant e-commerce platform built as a Yelo-inspired clone. Sello lets admins manage multiple merchant storefronts from a single dashboard while customers browse and shop through a beautiful customer-facing webapp.

---

## 📸 Overview

Sello is a **dual-panel commerce system**:

| Panel | Who uses it | Purpose |
|---|---|---|
| **Dashboard** | Admins & Merchants | Manage stores, products, categories, orders |
| **Webapp** | Customers | Browse stores, shop, and place orders |

The platform supports **role-based access control** — an Admin (MasterMerchant) can oversee all merchants and their stores, while each Merchant manages only their own storefront and inventory.

---

## ✨ Features

### 🏪 Dashboard (Admin & Merchant)

- **Dual-role Authentication** — Separate login flows for Admin and Merchant on the same page, with JWT-based session management
- **Merchant Signup** — New merchants can self-register; Admin approves/toggles their status
- **Dashboard Stats** — Live KPIs: total orders, revenue, active products, recent activity
- **Category Management** — Full CRUD for product categories with image uploads
- **Product Management** — Full CRUD with image uploads, pricing (MRP, discount %), GST %, delivery charge, and stock management
- **AI-Powered Descriptions** — One-click AI product description generation via OpenAI GPT
- **Order Management** — View all incoming orders; update order status (Pending → Confirmed → Delivered, etc.)
- **Order Settings** — Configure packing charges, min order amount, delivery radius, and more
- **Merchant Management** (Admin only) — View all merchants, search/filter, toggle active/inactive status
- **Store Profile** — Upload logo, update store name, description, and slug
- **Activity Log** — Tracks all major actions (product adds, order updates, etc.)
- **Notification System** — In-app notifications for key events
- **"Go to Webapp" shortcut** — One-click to jump from the dashboard to the live merchant storefront
- **Dark-mode first UI** — Glassmorphism modals, micro-animations, violet accent design system

### 🛒 Webapp (Customer-Facing)

- **Store Listing Page** — Browse all active merchant storefronts with hero section
- **Individual Store Page** — Full storefront with category filtering and product grid
- **Product Cards** — Show final price (with discount, GST, and delivery charge computed)
- **Cart Drawer** — Sliding cart with quantity controls, persistent across navigation
- **Wishlist** — Save favourite products
- **Checkout** — Cash on Delivery (COD) checkout flow with address collection
- **Order Success Page** — Confirmation screen with order number
- **Responsive Design** — Works on mobile, tablet, and desktop

---

## 🗂️ Repository Structure

```
workspace/
├── dashboard/          # Angular admin & merchant dashboard (port 4200)
│   ├── src/
│   │   └── app/
│   │       ├── pages/
│   │       │   ├── login/
│   │       │   ├── dashboard/
│   │       │   ├── categories/
│   │       │   ├── products/
│   │       │   ├── orders/
│   │       │   ├── order-settings/
│   │       │   ├── merchants/       # Admin-only
│   │       │   ├── store-profile/
│   │       │   ├── activity/
│   │       │   └── notifications/
│   │       ├── services/
│   │       └── guards/
│   └── ...
│
└── webapp/             # Angular customer storefront (port 4201)
    ├── src/
    │   └── app/
    │       ├── pages/
    │       │   ├── home/            # Store listing
    │       │   ├── store/           # Individual storefront
    │       │   ├── cart/
    │       │   ├── checkout/
    │       │   └── order-success/
    │       ├── components/
    │       │   ├── cart-drawer/
    │       │   └── navbar/
    │       └── services/
    └── ...
```

> **Note:** The backend source code is intentionally kept private and is not included in this repository.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | Angular 18 (standalone components) |
| **Styling** | Vanilla CSS — custom dark-mode design system |
| **API Communication** | Angular `HttpClient` with JWT interceptors |
| **State Management** | RxJS `BehaviorSubject` services |
| **Backend** | Node.js + Express (private) |
| **Database** | MySQL 8 (private) |
| **AI Integration** | OpenAI GPT API for product descriptions |
| **Auth** | JWT (Access Token) with role-based guards |

---

## 🎨 Design System

- **Base color:** `#0f0f13` | **Surface:** `#1a1a23`
- **Primary accent:** Violet `#7c5ef0`
- **Secondary accent:** Teal `#4fd1c5`
- **Font:** Inter (Google Fonts)
- Glassmorphism modals, smooth hover transitions, micro-animations
- Fully responsive — collapsible sidebar, adaptive product grids

---

## 🚀 Running the Frontend

> These frontends require a running Sello backend to function (API calls will fail without it).

### Dashboard

```bash
cd dashboard
npm install
npm run dev
# → http://localhost:4200
```

### Webapp

```bash
cd webapp
npm install
npm run dev
# → http://localhost:4201
```

---

## 🔐 Authentication Flow

1. **Admin** logs in with master credentials → gets `role: admin` JWT → sees all merchants + full dashboard
2. **Merchant** logs in or signs up → gets `role: merchant` JWT → sees only their own store data
3. **Customers** (webapp) browse without auth; checkout submits order to the public orders API

---

## 📡 Key API Modules (Backend — Private)

| Module | Description |
|---|---|
| `auth` | Login, signup, JWT issuance & profile |
| `catalog` | Categories CRUD with image handling |
| `products` | Product CRUD, AI description generation |
| `orders` | Order placement, status management, stats |
| `merchants` | Merchant listing & admin controls |
| `webapp` | Public storefront endpoints (stores, products) |
| `notifications` | In-app notification system |
| `activity` | Action audit log |

---

## 📄 License

This project is for educational/portfolio purposes. The backend is proprietary and not publicly distributed.

---

*Built with ❤️ by Sarthak Shishodia*
