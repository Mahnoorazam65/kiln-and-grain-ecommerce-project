import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ShoppingBag, X, Star, Plus, Minus, Search, ChevronRight, ChevronLeft, Check,
  ShieldCheck, Truck, CreditCard, Store, User, LogOut, Package, Users, ClipboardList,
  Trash2, Pencil, AlertCircle, Flame, TreePine, Shirt, Hammer,
} from "lucide-react";
import { apiFetch } from "./api.js";

/* ---------------------------------------------------------------
   DESIGN TOKENS — "Kiln & Grain"
--------------------------------------------------------------- */
const C = {
  ink: "#1B2A22", ink2: "#24352B",
  parchment: "#F3EEE1", parchmentDim: "#E8E1CE",
  brass: "#B98A3E", brassDark: "#8C6A2E", rust: "#9C4A2E",
  moss: "#7C8B73", charcoal: "#211D17", charcoalSoft: "#4A463D", line: "#3C4E41",
  page: "#FBF9F3",
};

const FONTS = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
    .kg-display { font-family: 'Fraunces', serif; }
    .kg-body { font-family: 'Inter', sans-serif; }
    .kg-mono { font-family: 'IBM Plex Mono', monospace; }
    @keyframes kg-tick { 0% { opacity: 0.3 } 100% { opacity: 1 } }
    .kg-tick { animation: kg-tick 0.6s ease-out; }
    .kg-scroll::-webkit-scrollbar { width: 6px; }
    .kg-scroll::-webkit-scrollbar-thumb { background: ${C.brass}; border-radius: 4px; }
    .kg-img { object-fit: cover; width: 100%; height: 100%; display: block; }
    body { margin: 0; }
  `}</style>
);

const CATEGORIES = ["All", "Ceramics", "Woodwork", "Textiles", "Metalwork"];
const fmt = (n) => `$${n.toFixed(2)}`;
const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

// If a product photo URL ever fails to load, swap in a neutral placeholder
// instead of showing a broken-image icon.
const IMG_FALLBACK = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="${C.parchmentDim}"/><text x="50%" y="50%" font-family="sans-serif" font-size="13" fill="${C.charcoalSoft}" text-anchor="middle" dominant-baseline="middle">Image unavailable</text></svg>`
);
function onImgError(e) { e.target.onerror = null; e.target.src = IMG_FALLBACK; }

// Designed product tile — gradient + a category icon rendered as inline SVG
// (same technique your star ratings and nav icons already use, which is why
// those always render). No <img>, no external file, no data: URI — just DOM
// elements, so there's nothing for anything on the system to block.
const PALETTE = [
  ["#B7C4A8", "#5F6E52", "#211D17"], ["#C9A46B", "#7A5A34", "#211D17"],
  ["#E6DCC6", "#B7A87F", "#211D17"], ["#9AA3A8", "#495157", "#211D17"],
  ["#3A3532", "#181513", "#F3EEE1"], ["#6E4A31", "#2E1D12", "#F3EEE1"],
  ["#8C4A2E", "#4A2515", "#F3EEE1"], ["#C98A4F", "#8B4A1E", "#211D17"],
];
const CATEGORY_ICON = { Ceramics: Flame, Woodwork: TreePine, Textiles: Shirt, Metalwork: Hammer };
function colorFor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function ProductVisual({ name, category, small }) {
  const [c1, c2, fg] = colorFor(name || "product");
  const Icon = CATEGORY_ICON[category] || Package;
  return (
    <div style={{ width: "100%", height: "100%", background: `linear-gradient(155deg, ${c1}, ${c2})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: small ? 4 : 10, padding: small ? 4 : 14, boxSizing: "border-box", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: small ? 60 : 140, height: small ? 60 : 140, borderRadius: "50%", border: `1px solid ${fg}`, opacity: 0.18, top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
      <Icon size={small ? 18 : 34} color={fg} strokeWidth={1.4} style={{ opacity: 0.92 }} />
      {!small && <span className="kg-display" style={{ color: fg, fontSize: 14, textAlign: "center", lineHeight: 1.25, fontWeight: 500, opacity: 0.95 }}>{name}</span>}
    </div>
  );
}

// Tries the real product photo first; if it ever fails to load for any
// reason, falls back to the guaranteed-reliable icon tile automatically —
// best of both without risking a broken-image icon anywhere in the app.
function ProductThumb({ img, name, category, small }) {
  const [failed, setFailed] = useState(false);
  if (!img || failed) return <ProductVisual name={name} category={category} small={small} />;
  return <img src={img} alt={name} className="kg-img" loading={small ? undefined : "lazy"} onError={() => setFailed(true)} />;
}

/* ---------------------------------------------------------------
   NORMALIZERS — map MongoDB documents to the flat shape the UI uses
--------------------------------------------------------------- */
function normalizeProduct(p) {
  const vendorObj = typeof p.vendor === "object" && p.vendor ? p.vendor : null;
  return {
    id: p._id, name: p.name, vendorId: vendorObj ? vendorObj._id : p.vendor,
    vendorName: vendorObj?.name, vendorStall: vendorObj?.stall, vendorStatus: vendorObj?.status,
    category: p.category, price: p.price, materials: p.materials, desc: p.desc, img: p.img,
    status: p.status, stock: p.stock, rating: p.rating || 0,
    reviews: (p.reviews || []).length, reviewsList: p.reviews || [],
  };
}
function normalizeVendor(v) {
  return { id: v._id, name: v.name, stall: v.stall, status: v.status, ownerEmail: v.ownerEmail };
}
function normalizeOrder(o) {
  return {
    id: o._id, customerId: o.customer?._id || o.customer,
    customerName: o.customer?.name, customerEmail: o.customer?.email,
    items: (o.items || []).map((it) => ({ productId: it.product, vendorId: it.vendor, name: it.name, price: it.price, qty: it.qty })),
    subtotal: o.subtotal, shippingFee: o.shippingFee, total: o.total,
    status: o.status, shippingInfo: o.shippingInfo, createdAt: new Date(o.createdAt).getTime(),
  };
}

/* ---------------------------------------------------------------
   SMALL SHARED PIECES
--------------------------------------------------------------- */
function StockGauge({ stock, max = 15 }) {
  const segments = 8;
  const filled = Math.max(0, Math.min(segments, Math.round((stock / max) * segments)));
  const tone = stock === 0 ? C.rust : stock <= 3 ? C.brass : C.moss;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", gap: 2 }}>
        {Array.from({ length: segments }).map((_, i) => (
          <div key={i} className={i < filled ? "kg-tick" : ""} style={{ width: 5, height: 12, background: i < filled ? tone : C.parchmentDim, borderRadius: 1 }} />
        ))}
      </div>
      <span className="kg-mono" style={{ fontSize: 11, color: tone, letterSpacing: 0.3 }}>{stock === 0 ? "SOLD OUT" : `${stock} IN STOCK`}</span>
    </div>
  );
}
function Stars({ rating, size = 13 }) {
  return (
    <div style={{ display: "flex", gap: 1 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} fill={i < Math.round(rating) ? C.brass : "none"} stroke={i < Math.round(rating) ? C.brass : C.moss} strokeWidth={1.5} />
      ))}
    </div>
  );
}
function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="kg-body" style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#F3D9D2", color: "#7A2E17", borderRadius: 4, padding: "10px 12px", fontSize: 13 }}>
      <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {message}
    </div>
  );
}

const qtyBtnStyle = { width: 26, height: 26, borderRadius: 3, border: `1px solid ${C.parchmentDim}`, background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 3, border: `1px solid ${C.parchmentDim}`, fontSize: 13, fontFamily: "'Inter', sans-serif", boxSizing: "border-box", background: "white", color: C.charcoal };
const labelStyle = { fontSize: 11, color: C.charcoalSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "block" };
const btnPrimary = (enabled) => ({ background: enabled ? C.ink : C.parchmentDim, color: enabled ? C.parchment : C.charcoalSoft, border: "none", borderRadius: 3, padding: "12px 18px", fontSize: 13, fontWeight: 600, cursor: enabled ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 });
const btnSecondary = { background: "white", color: C.charcoal, border: `1px solid ${C.parchmentDim}`, borderRadius: 3, padding: "12px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" };
const pill = (bg, fg) => ({ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, display: "inline-block" });

function StatusPill({ status }) {
  const map = {
    active: pill("#E1EAD9", "#3B5A2A"), approved: pill("#E1EAD9", "#3B5A2A"),
    pending: pill("#F6E6C8", "#8C6A2E"), suspended: pill("#F3D9D2", "#8C3A24"), removed: pill("#F3D9D2", "#8C3A24"),
    Processing: pill("#F6E6C8", "#8C6A2E"), Shipped: pill("#DCE6F0", "#2E4E70"), Delivered: pill("#E1EAD9", "#3B5A2A"), Cancelled: pill("#F3D9D2", "#8C3A24"),
  };
  return <span className="kg-body" style={map[status] || pill(C.parchmentDim, C.charcoalSoft)}>{status}</span>;
}

/* ---------------------------------------------------------------
   AUTH SCREENS — real signup/login against the API
--------------------------------------------------------------- */
function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "customer", shopName: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitLogin(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const { token, user } = await apiFetch("/auth/login", { method: "POST", body: { email: form.email, password: form.password } });
      onAuthed(token, user);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function submitSignup(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || (form.role === "vendor" && !form.shopName)) {
      setError("Fill in every field to continue."); return;
    }
    setError(""); setBusy(true);
    try {
      const { token, user } = await apiFetch("/auth/signup", { method: "POST", body: form });
      onAuthed(token, user);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="kg-body" style={{ minHeight: "100vh", background: C.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      {FONTS}
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "center", marginBottom: 28 }}>
          <Store size={20} color={C.brass} />
          <span className="kg-display" style={{ fontSize: 24, color: C.parchment, fontWeight: 500 }}>Kiln &amp; Grain</span>
        </div>
        <div style={{ background: C.parchment, borderRadius: 6, padding: 28 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 22, background: C.parchmentDim, borderRadius: 4, padding: 3 }}>
            {["login", "signup"].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} className="kg-body"
                style={{ flex: 1, padding: "9px", borderRadius: 3, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: mode === m ? C.ink : "transparent", color: mode === m ? C.parchment : C.charcoalSoft }}>
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          {mode === "login" ? (
            <form onSubmit={submitLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={labelStyle}>Email</label><input style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></div>
              <div><label style={labelStyle}>Password</label><input type="password" style={inputStyle} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /></div>
              <ErrorBanner message={error} />
              <button type="submit" disabled={busy} className="kg-body" style={{ ...btnPrimary(!busy), marginTop: 4 }}>{busy ? "Logging in…" : "Log in"}</button>
              <div className="kg-mono" style={{ fontSize: 11, color: C.charcoalSoft, background: "white", border: `1px solid ${C.parchmentDim}`, borderRadius: 4, padding: 10, lineHeight: 1.7 }}>
                DEMO ACCOUNTS (password: demo) — run <b>npm run seed</b> on the server first<br />
                customer@demo.com — shopper<br />
                vendor@demo.com — Ashgrove Pottery<br />
                admin@demo.com — site admin
              </div>
            </form>
          ) : (
            <form onSubmit={submitSignup} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={labelStyle}>Full name</label><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jordan Ellis" /></div>
              <div><label style={labelStyle}>Email</label><input style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></div>
              <div><label style={labelStyle}>Password</label><input type="password" style={inputStyle} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Choose a password" /></div>
              <div>
                <label style={labelStyle}>Account type</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["customer", "vendor"].map((r) => (
                    <button type="button" key={r} onClick={() => setForm({ ...form, role: r })} className="kg-body"
                      style={{ flex: 1, padding: "9px", borderRadius: 3, border: `1px solid ${form.role === r ? C.ink : C.parchmentDim}`, background: form.role === r ? C.ink : "white", color: form.role === r ? C.parchment : C.charcoal, fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              {form.role === "vendor" && (
                <div><label style={labelStyle}>Shop name</label><input style={inputStyle} value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} placeholder="e.g. Riverbank Ceramics" /></div>
              )}
              <ErrorBanner message={error} />
              <button type="submit" disabled={busy} className="kg-body" style={{ ...btnPrimary(!busy), marginTop: 4 }}>{busy ? "Creating account…" : "Create account"}</button>
              {form.role === "vendor" && <div className="kg-body" style={{ fontSize: 11, color: C.charcoalSoft }}>New shops go live once an admin approves them.</div>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   PRODUCT CARD + MODAL
--------------------------------------------------------------- */
function ProductCard({ product, onOpen, onAdd }) {
  const soldOut = product.stock === 0;
  return (
    <div style={{ background: C.parchment, borderRadius: 4, overflow: "hidden", border: `1px solid ${C.parchmentDim}`, display: "flex", flexDirection: "column", cursor: "pointer" }} onClick={() => onOpen(product)}>
      <div style={{ height: 160, position: "relative", background: C.parchmentDim }}>
        <ProductThumb img={product.img} name={product.name} category={product.category} />
        <div className="kg-mono" style={{ position: "absolute", top: 10, left: 10, background: "rgba(27,42,34,0.85)", color: C.parchment, fontSize: 10, padding: "3px 7px", borderRadius: 2, letterSpacing: 0.5 }}>STALL {product.vendorStall || "—"}</div>
      </div>
      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div className="kg-body" style={{ fontSize: 11, color: C.charcoalSoft, textTransform: "uppercase", letterSpacing: 0.6 }}>{product.vendorName || "Unknown vendor"}</div>
        <div className="kg-display" style={{ fontSize: 17, color: C.charcoal, lineHeight: 1.25, fontWeight: 500 }}>{product.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Stars rating={product.rating} />
          <span className="kg-mono" style={{ fontSize: 11, color: C.charcoalSoft }}>{product.rating.toFixed(1)} ({product.reviews})</span>
        </div>
        <StockGauge stock={product.stock} />
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8 }}>
          <span className="kg-mono" style={{ fontSize: 16, color: C.charcoal, fontWeight: 500 }}>{fmt(product.price)}</span>
          <button disabled={soldOut} onClick={(e) => { e.stopPropagation(); onAdd(product, 1); }} className="kg-body"
            style={{ background: soldOut ? C.parchmentDim : C.ink, color: soldOut ? C.charcoalSoft : C.parchment, border: "none", borderRadius: 3, padding: "7px 12px", fontSize: 12, fontWeight: 500, cursor: soldOut ? "not-allowed" : "pointer" }}>
            {soldOut ? "Sold out" : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductModal({ product, onClose, onAdd, onSubmitReview, currentUser }) {
  const [qty, setQty] = useState(1);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");
  useEffect(() => { setQty(1); setReviewText(""); setReviewError(""); }, [product]);
  if (!product) return null;
  const soldOut = product.stock === 0;

  async function submitReview() {
    if (!reviewText.trim()) { setReviewError("Write a few words first."); return; }
    setReviewBusy(true); setReviewError("");
    try { await onSubmitReview(product.id, reviewRating, reviewText.trim()); setReviewText(""); }
    catch (err) { setReviewError(err.message); }
    finally { setReviewBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(27,42,34,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="kg-scroll" style={{ background: C.parchment, borderRadius: 6, maxWidth: 780, width: "100%", maxHeight: "88vh", overflowY: "auto", display: "flex", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", height: 320, background: C.parchmentDim }}><ProductThumb img={product.img} name={product.name} category={product.category} /></div>
        <div style={{ flex: "1 1 380px", padding: 28, display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: C.charcoalSoft }}><X size={20} /></button>
          <div className="kg-mono" style={{ fontSize: 11, color: C.brassDark, letterSpacing: 0.6 }}>{(product.vendorName || "").toUpperCase()} · STALL {product.vendorStall}</div>
          <div className="kg-display" style={{ fontSize: 24, color: C.charcoal, fontWeight: 500 }}>{product.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Stars rating={product.rating} size={15} />
            <span className="kg-mono" style={{ fontSize: 12, color: C.charcoalSoft }}>{product.rating.toFixed(1)} · {product.reviews} reviews</span>
          </div>
          <p className="kg-body" style={{ fontSize: 14, color: C.charcoalSoft, lineHeight: 1.6, margin: 0 }}>{product.desc}</p>
          <div className="kg-mono" style={{ fontSize: 12, color: C.charcoalSoft }}>Materials — {product.materials}</div>
          <StockGauge stock={product.stock} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <span className="kg-mono" style={{ fontSize: 20, color: C.charcoal, fontWeight: 500 }}>{fmt(product.price)}</span>
            {!soldOut && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setQty(Math.max(1, qty - 1))} style={qtyBtnStyle}><Minus size={13} /></button>
                <span className="kg-mono" style={{ width: 18, textAlign: "center", fontSize: 13 }}>{qty}</span>
                <button onClick={() => setQty(Math.min(product.stock, qty + 1))} style={qtyBtnStyle}><Plus size={13} /></button>
              </div>
            )}
          </div>
          <button disabled={soldOut} onClick={() => { onAdd(product, qty); onClose(); }} className="kg-body"
            style={{ background: soldOut ? C.parchmentDim : C.ink, color: soldOut ? C.charcoalSoft : C.parchment, border: "none", borderRadius: 3, padding: "12px 16px", fontSize: 13, fontWeight: 500, cursor: soldOut ? "not-allowed" : "pointer", marginTop: 4 }}>
            {soldOut ? "Sold out" : "Add to cart"}
          </button>

          <div style={{ borderTop: `1px solid ${C.parchmentDim}`, marginTop: 10, paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="kg-body" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, color: C.charcoalSoft }}>Reviews ({product.reviewsList.length})</div>
            {product.reviewsList.map((r, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Stars rating={r.rating} size={11} />
                  <span className="kg-body" style={{ fontSize: 12, color: C.charcoal, fontWeight: 500 }}>{r.author}</span>
                </div>
                <p className="kg-body" style={{ fontSize: 13, color: C.charcoalSoft, margin: 0, lineHeight: 1.5 }}>{r.text}</p>
              </div>
            ))}
            {product.reviewsList.length === 0 && <div className="kg-body" style={{ fontSize: 12, color: C.charcoalSoft }}>No reviews yet.</div>}

            {currentUser && (
              <div style={{ borderTop: `1px solid ${C.parchmentDim}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="kg-body" style={{ fontSize: 12, fontWeight: 600, color: C.charcoal }}>Leave a review</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setReviewRating(n)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      <Star size={17} fill={n <= reviewRating ? C.brass : "none"} stroke={n <= reviewRating ? C.brass : C.moss} strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
                <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="What stood out about this piece?" />
                <ErrorBanner message={reviewError} />
                <button onClick={submitReview} disabled={reviewBusy} className="kg-body" style={{ ...btnSecondary, alignSelf: "flex-start" }}>{reviewBusy ? "Posting…" : "Post review"}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   CART DRAWER
--------------------------------------------------------------- */
function CartDrawer({ open, onClose, cart, updateQty, removeItem, onCheckout }) {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 380, maxWidth: "92vw", background: C.ink, color: C.parchment, zIndex: 60, transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.28s ease", display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.25)" }}>
      <div style={{ padding: "20px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.line}` }}>
        <div className="kg-display" style={{ fontSize: 19, fontWeight: 500 }}>Your cart</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.parchment, cursor: "pointer" }}><X size={20} /></button>
      </div>
      <div className="kg-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
        {cart.length === 0 && <div className="kg-body" style={{ color: C.moss, fontSize: 13, marginTop: 30, textAlign: "center" }}>Nothing in the cart yet.</div>}
        {cart.map((item) => (
          <div key={item.id} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: `1px solid ${C.line}` }}>
            <div style={{ width: 56, height: 56, borderRadius: 3, background: C.ink2, flexShrink: 0, overflow: "hidden" }}><ProductThumb img={item.img} name={item.name} category={item.category} small /></div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="kg-body" style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
              <div className="kg-mono" style={{ fontSize: 12, color: C.moss }}>{fmt(item.price)} each</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ ...qtyBtnStyle, background: C.ink2, border: `1px solid ${C.line}`, color: C.parchment }}><Minus size={12} /></button>
                <span className="kg-mono" style={{ fontSize: 12, width: 16, textAlign: "center" }}>{item.qty}</span>
                <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ ...qtyBtnStyle, background: C.ink2, border: `1px solid ${C.line}`, color: C.parchment }}><Plus size={12} /></button>
                <button onClick={() => removeItem(item.id)} className="kg-body" style={{ marginLeft: "auto", background: "none", border: "none", color: C.rust, fontSize: 12, cursor: "pointer" }}>Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {cart.length > 0 && (
        <div style={{ padding: 20, borderTop: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <span className="kg-body" style={{ fontSize: 13, color: C.moss }}>Subtotal</span>
            <span className="kg-mono" style={{ fontSize: 16, fontWeight: 500 }}>{fmt(subtotal)}</span>
          </div>
          <button onClick={onCheckout} className="kg-body" style={{ width: "100%", background: C.brass, color: C.ink, border: "none", borderRadius: 3, padding: "13px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Checkout</button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   CHECKOUT — shipping, live Stripe Elements payment, review, submit
--------------------------------------------------------------- */
function Stepper({ step }) {
  const steps = ["Shipping", "Payment", "Review"];
  return (
    <div style={{ display: "flex", gap: 0, marginBottom: 28 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "unset" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="kg-mono" style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, background: i <= step ? C.ink : C.parchmentDim, color: i <= step ? C.parchment : C.charcoalSoft }}>{i < step ? <Check size={12} /> : i + 1}</div>
            <span className="kg-body" style={{ fontSize: 13, color: i <= step ? C.charcoal : C.charcoalSoft, fontWeight: i === step ? 600 : 400 }}>{s}</span>
          </div>
          {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: C.parchmentDim, margin: "0 14px" }} />}
        </div>
      ))}
    </div>
  );
}
function Row({ label, value, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
      <span className="kg-body" style={{ fontSize: 12, color: C.charcoalSoft }}>{label}</span>
      <span className="kg-mono" style={{ fontSize: bold ? 15 : 13, fontWeight: bold ? 600 : 400, color: C.charcoal }}>{value}</span>
    </div>
  );
}

function Checkout({ cart, token, onBack, onPlaceOrder }) {
  const [step, setStep] = useState(0);
  const [shipping, setShipping] = useState({ name: "", address: "", city: "", zip: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [clientSecret, setClientSecret] = useState(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState("");
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const cardElRef = useRef(null);
  const cardMountRef = useRef(null);

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const shippingFee = subtotal > 75 ? 0 : 8;
  const total = subtotal + shippingFee;
  const shippingValid = shipping.name && shipping.address && shipping.city && shipping.zip;

  // Enter the payment step: request a PaymentIntent from the backend, then
  // mount a real Stripe Card Element (only if a publishable key is configured).
  useEffect(() => {
    if (step !== 1 || !STRIPE_PK) return;
    let cancelled = false;
    (async () => {
      try {
        setError("");
        const { clientSecret: cs } = await apiFetch("/payments/create-intent", { method: "POST", token, body: { amount: total } });
        if (cancelled) return;
        setClientSecret(cs);
        if (!window.Stripe) { setError("Stripe.js failed to load — check your connection and reload."); return; }
        const stripe = window.Stripe(STRIPE_PK);
        const elements = stripe.elements();
        const card = elements.create("card", { style: { base: { fontFamily: "Inter, sans-serif", fontSize: "14px", color: C.charcoal } } });
        card.mount(cardMountRef.current);
        card.on("change", (e) => { setCardComplete(e.complete); setCardError(e.error ? e.error.message : ""); });
        stripeRef.current = stripe; elementsRef.current = elements; cardElRef.current = card;
      } catch (err) { setError(err.message); }
    })();
    return () => {
      cancelled = true;
      if (cardElRef.current) { cardElRef.current.unmount(); cardElRef.current = null; }
    };
  }, [step]);

  async function placeOrder() {
    setBusy(true); setError("");
    try {
      let stripePaymentIntentId = null;
      if (STRIPE_PK && clientSecret && stripeRef.current && cardElRef.current) {
        const { error: confirmError, paymentIntent } = await stripeRef.current.confirmCardPayment(clientSecret, {
          payment_method: { card: cardElRef.current, billing_details: { name: shipping.name } },
        });
        if (confirmError) { setError(confirmError.message); setBusy(false); return; }
        stripePaymentIntentId = paymentIntent.id;
      }
      const items = cart.map((i) => ({ productId: i.id, qty: i.qty }));
      const { order } = await apiFetch("/orders", { method: "POST", token, body: { items, shippingInfo: shipping, stripePaymentIntentId } });
      onPlaceOrder(order);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px 80px" }}>
      <button onClick={onBack} className="kg-body" style={{ background: "none", border: "none", color: C.charcoalSoft, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 24 }}><ChevronLeft size={15} /> Back to shop</button>
      <div className="kg-display" style={{ fontSize: 26, fontWeight: 500, color: C.charcoal, marginBottom: 24 }}>Checkout</div>
      <Stepper step={step} />

      {step === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={labelStyle}>Full name</label><input style={inputStyle} value={shipping.name} onChange={(e) => setShipping({ ...shipping, name: e.target.value })} placeholder="Jordan Ellis" /></div>
          <div><label style={labelStyle}>Address</label><input style={inputStyle} value={shipping.address} onChange={(e) => setShipping({ ...shipping, address: e.target.value })} placeholder="118 Foundry Row" /></div>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>City</label><input style={inputStyle} value={shipping.city} onChange={(e) => setShipping({ ...shipping, city: e.target.value })} placeholder="Portland" /></div>
            <div style={{ width: 120 }}><label style={labelStyle}>ZIP</label><input style={inputStyle} value={shipping.zip} onChange={(e) => setShipping({ ...shipping, zip: e.target.value })} placeholder="97205" /></div>
          </div>
          <button disabled={!shippingValid} onClick={() => setStep(1)} className="kg-body" style={{ ...btnPrimary(shippingValid), width: "100%" }}>Continue to payment <ChevronRight size={14} /></button>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {STRIPE_PK ? (
            <>
              <div style={{ background: C.parchment, border: `1px solid ${C.parchmentDim}`, borderRadius: 4, padding: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <CreditCard size={16} color={C.brassDark} style={{ marginTop: 1, flexShrink: 0 }} />
                <span className="kg-body" style={{ fontSize: 12, color: C.charcoalSoft, lineHeight: 1.5 }}>Live Stripe test mode — use card <b>4242 4242 4242 4242</b>, any future expiry, any CVC. No real money moves.</span>
              </div>
              <div>
                <label style={labelStyle}>Card details</label>
                <div ref={cardMountRef} style={{ ...inputStyle, paddingTop: 12, paddingBottom: 12 }} />
                <ErrorBanner message={cardError} />
              </div>
            </>
          ) : (
            <div style={{ background: "#F6E6C8", color: "#5C4310", borderRadius: 4, padding: 14, fontSize: 12 }} className="kg-body">
              No Stripe publishable key is configured (<code>VITE_STRIPE_PUBLISHABLE_KEY</code>), so payment is skipped —
              the order will still be created, marked as payment pending. Add a key to <code>frontend/.env</code> to
              take real test-mode card input here.
            </div>
          )}
          <ErrorBanner message={error} />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(0)} className="kg-body" style={btnSecondary}>Back</button>
            <button disabled={STRIPE_PK && !cardComplete} onClick={() => setStep(2)} className="kg-body" style={{ ...btnPrimary(!STRIPE_PK || cardComplete), flex: 1 }}>Review order <ChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div className="kg-body" style={{ ...labelStyle, marginBottom: 10 }}>Items</div>
            {cart.map((item) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.parchmentDim}` }}>
                <span className="kg-body" style={{ fontSize: 13, color: C.charcoal }}>{item.name} <span className="kg-mono" style={{ color: C.charcoalSoft }}>× {item.qty}</span></span>
                <span className="kg-mono" style={{ fontSize: 13 }}>{fmt(item.price * item.qty)}</span>
              </div>
            ))}
          </div>
          <div style={{ background: C.parchment, border: `1px solid ${C.parchmentDim}`, borderRadius: 4, padding: 16 }}>
            <Row label="Ship to" value={`${shipping.name}, ${shipping.address}, ${shipping.city} ${shipping.zip}`} />
            <Row label="Subtotal" value={fmt(subtotal)} />
            <Row label="Shipping" value={shippingFee === 0 ? "Free" : fmt(shippingFee)} />
            <Row label="Total" value={fmt(total)} bold />
          </div>
          <ErrorBanner message={error} />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(1)} className="kg-body" style={btnSecondary}>Back</button>
            <button onClick={placeOrder} disabled={busy} className="kg-body" style={{ ...btnPrimary(!busy), flex: 1 }}>{busy ? "Placing order…" : "Place order"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Confirmation({ order, onContinue }) {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.ink, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={24} color={C.brass} /></div>
      <div className="kg-display" style={{ fontSize: 24, fontWeight: 500, color: C.charcoal }}>Order placed</div>
      <p className="kg-body" style={{ fontSize: 14, color: C.charcoalSoft, lineHeight: 1.6, margin: 0 }}>Your order has been saved and sent to each vendor's workshop for packing. Track its status any time from My Orders.</p>
      <div className="kg-mono" style={{ fontSize: 13, color: C.charcoalSoft, background: C.parchment, border: `1px solid ${C.parchmentDim}`, borderRadius: 4, padding: "10px 16px" }}>Order #{order.id.slice(-8).toUpperCase()} · {fmt(order.total)}</div>
      <button onClick={onContinue} className="kg-body" style={{ ...btnPrimary(true), marginTop: 10 }}>Continue shopping</button>
    </div>
  );
}

/* ---------------------------------------------------------------
   CUSTOMER: MY ORDERS
--------------------------------------------------------------- */
function MyOrders({ token }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiFetch("/orders/mine", { token }).then((d) => setOrders(d.orders.map(normalizeOrder))).catch((e) => setError(e.message));
  }, [token]);
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 20px 80px" }}>
      <div className="kg-display" style={{ fontSize: 24, fontWeight: 500, color: C.charcoal, marginBottom: 20 }}>My orders</div>
      <ErrorBanner message={error} />
      {orders === null && !error && <div className="kg-body" style={{ color: C.charcoalSoft, fontSize: 13 }}>Loading…</div>}
      {orders && orders.length === 0 && <div className="kg-body" style={{ color: C.charcoalSoft, fontSize: 14 }}>No orders yet — anything you buy will show up here.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {orders && orders.map((o) => (
          <div key={o.id} style={{ background: C.parchment, border: `1px solid ${C.parchmentDim}`, borderRadius: 5, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span className="kg-mono" style={{ fontSize: 13, color: C.charcoal, fontWeight: 500 }}>Order #{o.id.slice(-8).toUpperCase()}</span>
              <StatusPill status={o.status} />
            </div>
            {o.items.map((it, idx) => <div key={idx} className="kg-body" style={{ fontSize: 13, color: C.charcoalSoft, padding: "3px 0" }}>{it.name} × {it.qty}</div>)}
            <div style={{ borderTop: `1px solid ${C.parchmentDim}`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
              <span className="kg-mono" style={{ fontSize: 12, color: C.charcoalSoft }}>{new Date(o.createdAt).toLocaleDateString()}</span>
              <span className="kg-mono" style={{ fontSize: 14, fontWeight: 500 }}>{fmt(o.total)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   VENDOR DASHBOARD
--------------------------------------------------------------- */
function ProductForm({ initial, onSave, onCancel, busy }) {
  const [f, setF] = useState(initial || { name: "", category: "Ceramics", price: "", stock: "", materials: "", desc: "", img: "" });
  return (
    <div style={{ background: "white", border: `1px solid ${C.parchmentDim}`, borderRadius: 5, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px" }}><label style={labelStyle}>Product name</label><input style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ash-Glaze Pour Vessel" /></div>
        <div style={{ width: 160 }}>
          <label style={labelStyle}>Category</label>
          <select style={inputStyle} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ flex: 1 }}><label style={labelStyle}>Price ($)</label><input type="number" min="0" style={inputStyle} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="68" /></div>
        <div style={{ flex: 1 }}><label style={labelStyle}>Stock</label><input type="number" min="0" style={inputStyle} value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} placeholder="6" /></div>
      </div>
      <div><label style={labelStyle}>Materials</label><input style={inputStyle} value={f.materials} onChange={(e) => setF({ ...f, materials: e.target.value })} placeholder="Stoneware, ash glaze" /></div>
      <div><label style={labelStyle}>Description</label><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder="What makes this piece worth telling a story about?" /></div>
      <div>
        <label style={labelStyle}>Image URL</label>
        <input style={inputStyle} value={f.img} onChange={(e) => setF({ ...f, img: e.target.value })} placeholder="https://..." />
        <div style={{ marginTop: 8, width: 100, height: 80, borderRadius: 3, overflow: "hidden", background: C.parchmentDim }}><img src={f.img} alt="preview" className="kg-img" onError={(e) => { e.target.style.opacity = 0.3; }} /></div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button onClick={onCancel} className="kg-body" style={btnSecondary}>Cancel</button>
        <button onClick={() => onSave({ ...f, price: parseFloat(f.price) || 0, stock: parseInt(f.stock) || 0 })} disabled={!f.name || !f.price || busy} className="kg-body" style={{ ...btnPrimary(f.name && f.price && !busy), flex: 1 }}>{busy ? "Saving…" : "Save product"}</button>
      </div>
    </div>
  );
}

function VendorDashboard({ token }) {
  const [tab, setTab] = useState("products");
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try { const d = await apiFetch("/vendors/me", { token }); setData(d); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, [token]);

  async function addProduct(p) {
    setBusy(true); setError("");
    try { await apiFetch("/products", { method: "POST", token, body: p }); setEditing(null); await load(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function updateProduct(id, p) {
    setBusy(true); setError("");
    try { await apiFetch(`/products/${id}`, { method: "PATCH", token, body: p }); setEditing(null); await load(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function deleteProduct(id) {
    try { await apiFetch(`/products/${id}`, { method: "DELETE", token }); await load(); }
    catch (err) { setError(err.message); }
  }

  if (!data) return <div style={{ maxWidth: 920, margin: "0 auto", padding: 40 }}><ErrorBanner message={error} />{!error && <div className="kg-body" style={{ color: C.charcoalSoft }}>Loading…</div>}</div>;

  const { vendor, products, orders } = data;
  const productsN = products.map(normalizeProduct);
  const ordersN = orders.map(normalizeOrder);

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "36px 20px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="kg-display" style={{ fontSize: 26, fontWeight: 500, color: C.charcoal }}>{vendor.name}</div>
        <StatusPill status={vendor.status} />
      </div>
      <div className="kg-mono" style={{ fontSize: 12, color: C.charcoalSoft, marginBottom: 22 }}>Stall {vendor.stall}</div>
      <ErrorBanner message={error} />

      {vendor.status === "pending" && (
        <div style={{ background: "#F6E6C8", color: "#5C4310", borderRadius: 4, padding: 12, fontSize: 13, margin: "12px 0" }} className="kg-body">Your shop is awaiting admin approval. Products you add now stay hidden from the storefront until then.</div>
      )}

      <div style={{ display: "flex", gap: 4, margin: "22px 0", borderBottom: `1px solid ${C.parchmentDim}` }}>
        {[{ k: "products", label: "My products" }, { k: "orders", label: "My orders" }].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className="kg-body" style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === t.k ? C.brass : "transparent"}`, padding: "10px 4px", marginRight: 20, fontSize: 13, fontWeight: tab === t.k ? 600 : 400, color: tab === t.k ? C.charcoal : C.charcoalSoft, cursor: "pointer" }}>{t.label}</button>
        ))}
      </div>

      {tab === "products" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {editing === "new" && <ProductForm busy={busy} onCancel={() => setEditing(null)} onSave={addProduct} />}
          {editing && editing !== "new" && <ProductForm busy={busy} initial={editing} onCancel={() => setEditing(null)} onSave={(p) => updateProduct(editing.id, p)} />}
          {!editing && <button onClick={() => setEditing("new")} className="kg-body" style={{ ...btnPrimary(true), alignSelf: "flex-start" }}><Plus size={14} /> Add product</button>}
          {productsN.length === 0 && <div className="kg-body" style={{ color: C.charcoalSoft, fontSize: 13 }}>No products yet — add your first one above.</div>}
          {productsN.map((p) => (
            <div key={p.id} style={{ display: "flex", gap: 14, background: "white", border: `1px solid ${C.parchmentDim}`, borderRadius: 5, padding: 12, alignItems: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 3, overflow: "hidden", flexShrink: 0, background: C.parchmentDim }}><ProductThumb img={p.img} name={p.name} category={p.category} small /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="kg-body" style={{ fontSize: 13, fontWeight: 500, color: C.charcoal }}>{p.name}</div>
                <div className="kg-mono" style={{ fontSize: 11, color: C.charcoalSoft }}>{fmt(p.price)} · {p.category}</div>
              </div>
              <StockGauge stock={p.stock} />
              <button onClick={() => setEditing(p)} style={{ ...qtyBtnStyle, width: 30, height: 30 }}><Pencil size={13} /></button>
              <button onClick={() => deleteProduct(p.id)} style={{ ...qtyBtnStyle, width: 30, height: 30, color: C.rust }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {tab === "orders" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ordersN.length === 0 && <div className="kg-body" style={{ color: C.charcoalSoft, fontSize: 13 }}>No orders containing your products yet.</div>}
          {ordersN.map((o) => (
            <div key={o.id} style={{ background: "white", border: `1px solid ${C.parchmentDim}`, borderRadius: 5, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span className="kg-mono" style={{ fontSize: 12, color: C.charcoal, fontWeight: 500 }}>Order #{o.id.slice(-8).toUpperCase()}</span>
                <StatusPill status={o.status} />
              </div>
              {o.items.filter((it) => it.vendorId === vendor.id).map((it, idx) => <div key={idx} className="kg-body" style={{ fontSize: 12, color: C.charcoalSoft }}>{it.name} × {it.qty} — {fmt(it.price * it.qty)}</div>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   ADMIN DASHBOARD
--------------------------------------------------------------- */
function AdminDashboard({ token }) {
  const [tab, setTab] = useState("vendors");
  const [vendors, setVendors] = useState(null);
  const [products, setProducts] = useState(null);
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const orderStatuses = ["Processing", "Shipped", "Delivered", "Cancelled"];

  async function loadAll() {
    try {
      const [v, p, o] = await Promise.all([
        apiFetch("/vendors", { token }),
        apiFetch("/products/admin/all", { token }),
        apiFetch("/orders", { token }),
      ]);
      setVendors(v.vendors.map(normalizeVendor));
      setProducts(p.products.map(normalizeProduct));
      setOrders(o.orders.map(normalizeOrder));
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { loadAll(); }, [token]);

  async function setVendorStatus(id, status) {
    try { await apiFetch(`/vendors/${id}/status`, { method: "PATCH", token, body: { status } }); await loadAll(); }
    catch (err) { setError(err.message); }
  }
  async function setProductStatus(id, status) {
    try { await apiFetch(`/products/${id}`, { method: "PATCH", token, body: { status } }); await loadAll(); }
    catch (err) { setError(err.message); }
  }
  async function deleteProduct(id) {
    try { await apiFetch(`/products/${id}`, { method: "DELETE", token }); await loadAll(); }
    catch (err) { setError(err.message); }
  }
  async function setOrderStatus(id, status) {
    try { await apiFetch(`/orders/${id}/status`, { method: "PATCH", token, body: { status } }); await loadAll(); }
    catch (err) { setError(err.message); }
  }

  const loading = !vendors || !products || !orders;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 20px 80px" }}>
      <div className="kg-display" style={{ fontSize: 26, fontWeight: 500, color: C.charcoal, marginBottom: 6 }}>Admin panel</div>
      <div className="kg-body" style={{ fontSize: 13, color: C.charcoalSoft, marginBottom: 22 }}>Manage vendors, products, and orders across the marketplace.</div>
      <ErrorBanner message={error} />
      {loading && !error && <div className="kg-body" style={{ color: C.charcoalSoft, fontSize: 13 }}>Loading…</div>}

      {!loading && (
        <>
          <div style={{ display: "flex", gap: 4, margin: "22px 0", borderBottom: `1px solid ${C.parchmentDim}` }}>
            {[{ k: "vendors", label: "Vendors", icon: Users }, { k: "products", label: "Products", icon: Package }, { k: "orders", label: "Orders", icon: ClipboardList }].map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} className="kg-body" style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === t.k ? C.brass : "transparent"}`, padding: "10px 4px", marginRight: 20, fontSize: 13, fontWeight: tab === t.k ? 600 : 400, color: tab === t.k ? C.charcoal : C.charcoalSoft, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><t.icon size={14} /> {t.label}</button>
            ))}
          </div>

          {tab === "vendors" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {vendors.map((v) => (
                <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 14, background: "white", border: `1px solid ${C.parchmentDim}`, borderRadius: 5, padding: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div className="kg-body" style={{ fontSize: 13, fontWeight: 500, color: C.charcoal }}>{v.name}</div>
                    <div className="kg-mono" style={{ fontSize: 11, color: C.charcoalSoft }}>Stall {v.stall} · {v.ownerEmail}</div>
                  </div>
                  <StatusPill status={v.status} />
                  {v.status !== "approved" && <button onClick={() => setVendorStatus(v.id, "approved")} className="kg-body" style={{ ...btnSecondary, padding: "7px 12px", fontSize: 12 }}>Approve</button>}
                  {v.status !== "suspended" && <button onClick={() => setVendorStatus(v.id, "suspended")} className="kg-body" style={{ ...btnSecondary, padding: "7px 12px", fontSize: 12, color: C.rust }}>Suspend</button>}
                </div>
              ))}
            </div>
          )}

          {tab === "products" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {products.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, background: "white", border: `1px solid ${C.parchmentDim}`, borderRadius: 5, padding: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 3, overflow: "hidden", flexShrink: 0, background: C.parchmentDim }}><ProductThumb img={p.img} name={p.name} category={p.category} small /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="kg-body" style={{ fontSize: 13, fontWeight: 500, color: C.charcoal }}>{p.name}</div>
                    <div className="kg-mono" style={{ fontSize: 11, color: C.charcoalSoft }}>{p.vendorName} · {fmt(p.price)}</div>
                  </div>
                  <StatusPill status={p.status} />
                  {p.status !== "active" && <button onClick={() => setProductStatus(p.id, "active")} className="kg-body" style={{ ...btnSecondary, padding: "7px 12px", fontSize: 12 }}>Approve</button>}
                  {p.status === "active" && <button onClick={() => setProductStatus(p.id, "pending")} className="kg-body" style={{ ...btnSecondary, padding: "7px 12px", fontSize: 12 }}>Unlist</button>}
                  <button onClick={() => deleteProduct(p.id)} style={{ ...qtyBtnStyle, width: 30, height: 30, color: C.rust }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}

          {tab === "orders" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {orders.length === 0 && <div className="kg-body" style={{ color: C.charcoalSoft, fontSize: 13 }}>No orders placed yet.</div>}
              {orders.map((o) => (
                <div key={o.id} style={{ background: "white", border: `1px solid ${C.parchmentDim}`, borderRadius: 5, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                    <span className="kg-mono" style={{ fontSize: 12, color: C.charcoal, fontWeight: 500 }}>Order #{o.id.slice(-8).toUpperCase()} · {fmt(o.total)}</span>
                    <select value={o.status} onChange={(e) => setOrderStatus(o.id, e.target.value)} className="kg-body" style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 12 }}>
                      {orderStatuses.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  {o.items.map((it, idx) => <div key={idx} className="kg-body" style={{ fontSize: 12, color: C.charcoalSoft }}>{it.name} × {it.qty}</div>)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   NAV
--------------------------------------------------------------- */
function NavBar({ currentUser, cartCount, view, setView, onCartClick, onLogout, query, setQuery }) {
  const roleLinks = {
    customer: [{ k: "shop", label: "Shop" }, { k: "orders", label: "My orders" }],
    vendor: [{ k: "shop", label: "Shop" }, { k: "vendor", label: "Vendor dashboard" }],
    admin: [{ k: "shop", label: "Shop" }, { k: "admin", label: "Admin panel" }],
  };
  const links = roleLinks[currentUser.role] || [];
  return (
    <div style={{ background: C.ink, color: C.parchment, padding: "14px 24px", position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
        <div onClick={() => setView("shop")} style={{ display: "flex", alignItems: "baseline", gap: 8, cursor: "pointer" }}>
          <Store size={18} color={C.brass} /><span className="kg-display" style={{ fontSize: 20, fontWeight: 500 }}>Kiln &amp; Grain</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {links.map((l) => (
            <button key={l.k} onClick={() => setView(l.k)} className="kg-body" style={{ background: view === l.k ? C.ink2 : "none", border: "none", borderRadius: 3, padding: "7px 12px", fontSize: 13, color: C.parchment, cursor: "pointer", fontWeight: view === l.k ? 600 : 400 }}>{l.label}</button>
          ))}
        </div>
        {view === "shop" && (
          <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 280 }}>
            <Search size={14} color={C.moss} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" className="kg-body" style={{ width: "100%", background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 3, padding: "8px 10px 8px 30px", fontSize: 13, color: C.parchment, boxSizing: "border-box" }} />
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onCartClick} style={{ background: "none", border: "none", color: C.parchment, cursor: "pointer", position: "relative" }}>
            <ShoppingBag size={20} />
            {cartCount > 0 && <span className="kg-mono" style={{ position: "absolute", top: -8, right: -8, background: C.brass, color: C.ink, fontSize: 10, borderRadius: "50%", width: 17, height: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.ink2, display: "flex", alignItems: "center", justifyContent: "center" }}><User size={13} /></div>
            <span className="kg-body" style={{ fontSize: 12, color: C.parchment }}>{currentUser.name}</span>
            <button onClick={onLogout} title="Log out" style={{ background: "none", border: "none", color: C.moss, cursor: "pointer", display: "flex" }}><LogOut size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   APP ROOT
--------------------------------------------------------------- */
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("kg_token") || null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [view, setView] = useState("shop");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [activeProductId, setActiveProductId] = useState(null);
  const [orderResult, setOrderResult] = useState(null);

  // On load, verify any stored token against the API.
  useEffect(() => {
    if (!token) { setAuthChecked(true); return; }
    apiFetch("/auth/me", { token })
      .then((d) => setCurrentUser(d.user))
      .catch(() => { localStorage.removeItem("kg_token"); setToken(null); })
      .finally(() => setAuthChecked(true));
  }, []);

  async function fetchProducts() {
    try {
      const { products: raw } = await apiFetch("/products");
      setProducts(raw.map(normalizeProduct));
      setProductsError("");
    } catch (err) { setProductsError(err.message); }
    finally { setProductsLoading(false); }
  }

  // Load the public catalog once logged in, and poll periodically so stock
  // levels reflect real orders placed by anyone — a genuine real-time view.
  useEffect(() => {
    if (!currentUser) return;
    fetchProducts();
    const t = setInterval(fetchProducts, 8000);
    return () => clearInterval(t);
  }, [currentUser]);

  const filtered = useMemo(() => products.filter((p) => {
    const inCat = category === "All" || p.category === category;
    const inQuery = p.name.toLowerCase().includes(query.toLowerCase()) || (p.materials || "").toLowerCase().includes(query.toLowerCase());
    return inCat && inQuery;
  }), [products, category, query]);

  const activeProduct = products.find((p) => p.id === activeProductId) || null;
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  function handleAuthed(tok, user) {
    localStorage.setItem("kg_token", tok);
    setToken(tok); setCurrentUser(user); setView("shop");
  }
  function handleLogout() {
    localStorage.removeItem("kg_token");
    setToken(null); setCurrentUser(null); setCart([]); setView("shop"); setProducts([]);
  }

  function addToCart(product, qty) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) return prev.map((i) => (i.id === product.id ? { ...i, qty: Math.min(product.stock, i.qty + qty) } : i));
      return [...prev, { id: product.id, name: product.name, price: product.price, img: product.img, category: product.category, qty }];
    });
    setCartOpen(true);
  }
  function updateQty(id, qty) {
    if (qty <= 0) { setCart((prev) => prev.filter((i) => i.id !== id)); return; }
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty } : i)));
  }
  function removeItem(id) { setCart((prev) => prev.filter((i) => i.id !== id)); }

  function handleOrderPlaced(rawOrder) {
    setOrderResult(normalizeOrder(rawOrder));
    setCart([]);
    setView("confirmation");
    fetchProducts();
  }

  async function submitReview(productId, rating, text) {
    await apiFetch(`/products/${productId}/reviews`, { method: "POST", token, body: { rating, text } });
    await fetchProducts();
  }

  if (!authChecked) return null;
  if (!currentUser) return <AuthScreen onAuthed={handleAuthed} />;

  return (
    <div className="kg-body" style={{ minHeight: "100vh", background: C.page }}>
      {FONTS}
      <NavBar currentUser={currentUser} cartCount={cartCount} view={view} setView={setView} onCartClick={() => setCartOpen(true)} onLogout={handleLogout} query={query} setQuery={setQuery} />

      {view === "shop" && (
        <>
          <div style={{ borderBottom: `1px solid ${C.parchmentDim}`, background: C.page, position: "sticky", top: 61, zIndex: 30 }}>
            <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", gap: 4, padding: "0 24px", overflowX: "auto" }}>
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)} className="kg-body" style={{ background: "none", border: "none", borderBottom: `2px solid ${category === c ? C.brass : "transparent"}`, padding: "12px 14px", fontSize: 13, fontWeight: category === c ? 600 : 400, color: category === c ? C.charcoal : C.charcoalSoft, cursor: "pointer", whiteSpace: "nowrap" }}>{c}</button>
              ))}
            </div>
          </div>

          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "36px 24px 8px" }}>
            <div className="kg-display" style={{ fontSize: 32, fontWeight: 500, color: C.charcoal, maxWidth: 520, lineHeight: 1.15 }}>Goods from the workshop, not the warehouse.</div>
            <p className="kg-body" style={{ fontSize: 14, color: C.charcoalSoft, maxWidth: 480, marginTop: 10, lineHeight: 1.6 }}>Every piece here ships from the maker who built it. Stock counts refresh from the database automatically.</p>
          </div>

          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "16px 24px 60px" }}>
            <ErrorBanner message={productsError} />
            {productsLoading && <div className="kg-body" style={{ color: C.charcoalSoft, fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading products from the API…</div>}
            {!productsLoading && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 18 }}>
                {filtered.map((p) => <ProductCard key={p.id} product={p} onOpen={(pr) => setActiveProductId(pr.id)} onAdd={addToCart} />)}
              </div>
            )}
            {!productsLoading && filtered.length === 0 && !productsError && <div className="kg-body" style={{ textAlign: "center", padding: "60px 0", color: C.charcoalSoft, fontSize: 14 }}>No products match that search.</div>}
          </div>

          <div style={{ background: C.ink2, padding: "20px 24px" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Truck size={15} color={C.brass} /><span className="kg-body" style={{ fontSize: 12, color: C.parchment }}>Free shipping over $75</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck size={15} color={C.brass} /><span className="kg-body" style={{ fontSize: 12, color: C.parchment }}>Vendor-backed guarantee</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Star size={15} color={C.brass} /><span className="kg-body" style={{ fontSize: 12, color: C.parchment }}>Verified maker reviews</span></div>
            </div>
          </div>
        </>
      )}

      {view === "checkout" && <Checkout cart={cart} token={token} onBack={() => setView("shop")} onPlaceOrder={handleOrderPlaced} />}
      {view === "confirmation" && orderResult && <Confirmation order={orderResult} onContinue={() => setView("shop")} />}
      {view === "orders" && <MyOrders token={token} />}
      {view === "vendor" && currentUser.role === "vendor" && <VendorDashboard token={token} />}
      {view === "admin" && currentUser.role === "admin" && <AdminDashboard token={token} />}

      <ProductModal product={activeProduct} currentUser={currentUser} onClose={() => setActiveProductId(null)} onAdd={addToCart} onSubmitReview={submitReview} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} updateQty={updateQty} removeItem={removeItem} onCheckout={() => { setCartOpen(false); setView("checkout"); }} />
      {cartOpen && <div onClick={() => setCartOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 55 }} />}
    </div>
  );
}
