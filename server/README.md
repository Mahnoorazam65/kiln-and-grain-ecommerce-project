# Kiln & Grain API

A Node/Express + MongoDB backend for the marketplace frontend. This README assumes you have
never set up MongoDB or Stripe before — follow it top to bottom.

## Get Stripe test keys (optional, for real payment UI)

1. Go to https://dashboard.stripe.com/register and create a free account.
2. Once in the dashboard, make sure you're in **Test mode** (toggle top-right).
3. Go to **Developers → API keys** and copy the **Secret key**
   You'll also want the **Publishable key** for the frontend later.

## Configure the project

cd server
cp .env.example .env

## Install dependencies and seed demo data

```bash
npm install
npm run seed
```

This wipes and recreates demo vendors, products, and three demo accounts (password `demo`
for all): `customer@demo.com`, `vendor@demo.com`, `admin@demo.com`.

## Run the server

```bash
npm start
```

You should see `MongoDB connected` and `Kiln & Grain API listening on port 4000`.

## API overview

| Method | Route                         | Who                  | Purpose                                      |
| ------ | ----------------------------- | -------------------- | -------------------------------------------- |
| POST   | `/api/auth/signup`            | anyone               | create a customer or vendor account          |
| POST   | `/api/auth/login`             | anyone               | log in, returns a JWT                        |
| GET    | `/api/auth/me`                | logged in            | current user info                            |
| GET    | `/api/products`               | anyone               | browse active products (`?category=`, `?q=`) |
| GET    | `/api/products/:id`           | anyone               | single product detail                        |
| POST   | `/api/products`               | vendor               | add a product to your shop                   |
| PATCH  | `/api/products/:id`           | vendor (own) / admin | edit a product                               |
| DELETE | `/api/products/:id`           | vendor (own) / admin | remove a product                             |
| POST   | `/api/products/:id/reviews`   | logged in            | leave a review                               |
| GET    | `/api/vendors`                | admin                | list all vendors                             |
| GET    | `/api/vendors/me`             | vendor               | your shop + products + orders                |
| PATCH  | `/api/vendors/:id/status`     | admin                | approve/suspend a vendor                     |
| POST   | `/api/orders`                 | customer             | place an order (checkout)                    |
| GET    | `/api/orders/mine`            | customer             | your order history                           |
| GET    | `/api/orders`                 | admin                | every order                                  |
| PATCH  | `/api/orders/:id/status`      | admin                | update fulfillment status                    |
| POST   | `/api/payments/create-intent` | customer             | start a Stripe payment                       |
