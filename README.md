# Kiln & Grain — Multi-Vendor E-Commerce Marketplace

A full-featured multi-vendor marketplace with role-based access (customer / vendor / admin),
product browsing, cart, live Stripe checkout, reviews & ratings, and admin/vendor dashboards —
**frontend and backend are connected**: the UI reads and writes real data through the API below.

## Project structure

```
kiln-and-grain/
├── frontend/     React + Vite storefront, vendor dashboard, admin panel (calls the API)
├── server/       Node/Express + MongoDB API (auth, products, vendors, orders, Stripe)
└── README.md     this file
```

## Features

- **Authentication & role-based access** — customer, vendor, and admin roles, JWT sessions,
  persisted in the browser so a refresh keeps you logged in
- **Product listing, cart, checkout** — category filters, search, multi-step checkout
- **Payment integration** — real Stripe Elements card entry in test mode, backed by the
  server's Payment Intents endpoint; works without a Stripe key too (order still saves,
  payment marked pending) so the app runs even before you've set one up
- **Reviews & ratings** — logged-in users can post a star rating and written review, which
  saves to MongoDB and recalculates the product's average immediately
- **Admin panel** — approve/suspend vendors, approve/unlist/remove products, update order
  fulfillment status, all against live data
- **Vendor dashboard** — add/edit/delete your own products, see orders containing your items
- **Real-time-style stock tracking** — the storefront polls the API every few seconds, so
  stock counts reflect actual orders placed by anyone, and the backend decrements stock
  atomically per order

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, lucide-react icons, Stripe.js |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose ODM) |
| Auth | JWT + bcrypt password hashing |
| Payments | Stripe (Payment Intents API + Elements) |

## Quick start (both pieces, in order)

**1. Start the backend first** — the frontend has nothing to talk to without it. Follow
`server/README.md` in full the first time (it walks through getting a free MongoDB Atlas
database and, optionally, Stripe test keys). Short version:
```bash
cd server
cp .env.example .env      # fill in MONGODB_URI, JWT_SECRET, (optional) STRIPE_SECRET_KEY
npm install
npm run seed               # creates demo vendors, products, and accounts
npm start                  # http://localhost:4000
```

**2. Start the frontend:**
```bash
cd frontend
cp .env.example .env       # defaults already point at http://localhost:4000/api
npm install
npm run dev                # http://localhost:5173
```

Demo logins (password `demo` for all, created by `npm run seed`): `customer@demo.com`,
`vendor@demo.com`, `admin@demo.com`. You can also sign up fresh from the login screen.

## Enabling real Stripe test payments

The checkout works either way, but to see an actual Stripe card form:
1. Get test keys at https://dashboard.stripe.com/test/apikeys
2. Put the **secret key** (`sk_test_...`) in `server/.env` as `STRIPE_SECRET_KEY`
3. Put the **publishable key** (`pk_test_...`) in `frontend/.env` as `VITE_STRIPE_PUBLISHABLE_KEY`
4. Restart both. Use test card `4242 4242 4242 4242`, any future expiry, any CVC.

## Known limitations

- Both pieces run locally by default — deploying them publicly (e.g. Render/Railway for
  the API, Vercel/Netlify for the frontend) is covered in `server/README.md` but not done
  for you, since it requires accounts only you can create.
- Product photos are illustrated artwork generated for this project, not photography of
  real physical products — these are fictional demo products. They're real JPG files
  bundled in `frontend/public/images/` and served from the app itself (not fetched from
  any external site), so they don't depend on any outside service being reachable.
- No automated tests included.
- The "real-time" stock updates are done by polling every 8 seconds, not a websocket push —
  fine for a demo/course project, but worth naming if asked about the architecture.
