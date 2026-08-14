# Kiln & Grain — Frontend

React + Vite storefront covering the customer, vendor, and admin experience, connected to
the `../server` API for real data, auth, and payments.

## Run it

The backend must be running first (see `../server/README.md`).

```bash
cp .env.example .env    # defaults point at http://localhost:4000/api
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Demo accounts

Password is `demo` for all three — created by running `npm run seed` in `../server`:

| Email | Role |
|---|---|
| customer@demo.com | Customer |
| vendor@demo.com | Vendor (Ashgrove Pottery) |
| admin@demo.com | Admin |

You can also sign up as a new customer or vendor from the login screen.

## Notes

- All data (users, products, orders, reviews) is read from and written to the backend's
  MongoDB database — nothing here is mock data anymore.
- The product catalog polls the API every 8 seconds so stock levels stay current with
  whatever anyone has ordered.
- Checkout uses real Stripe Elements in test mode if `VITE_STRIPE_PUBLISHABLE_KEY` is set;
  otherwise it skips card entry and creates the order with payment marked pending.
