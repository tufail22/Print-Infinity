"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Store,
  Printer,
  DollarSign,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  LogOut,
  Mail,
  KeyRound,
  ArrowLeft,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Image as ImageIcon,
  MapPin,
  HelpCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface StoreData {
  id: string;
  name: string;
  address: string | null;
  logo_url: string | null;
  bw_price_per_page: number;
  color_price_per_page: number;
  active: boolean;
}

interface PrinterData {
  id: string;
  name: string;
  type: "bw" | "color";
  connection: string;
  windows_printer_name: string;
  is_online: boolean;
}

export default function AdminPage() {
  // Auth state
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Store data state
  const [store, setStore] = useState<StoreData | null>(null);
  const [printers, setPrinters] = useState<PrinterData[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Check auth session
  useEffect(() => {
    async function checkUser() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
      } catch (err) {
        console.error("Session check error:", err);
      } finally {
        setLoadingAuth(false);
      }
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load store details dynamically for logged-in storekeeper
  const loadStoreData = async (userId?: string) => {
    try {
      setLoadingData(true);
      const uid = userId || session?.user?.id;
      const url = uid
        ? `/api/store/manage?user_id=${uid}`
        : `/api/store/manage?store_id=a0000000-0000-0000-0000-000000000001`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && json.store) {
        setStore(json.store);
        setPrinters(json.printers || []);
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: "Failed to load store settings." });
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      loadStoreData(session.user.id);
    }
  }, [session]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setAuthError(error.message || "Invalid storekeeper email or password.");
      } else if (data.session) {
        setSession(data.session);
        if (data.session.user?.id) {
          await loadStoreData(data.session.user.id);
        }
      }
    } catch (err: any) {
      setAuthError(err.message || "Sign in failed. Please try again.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!storeName.trim()) {
      setAuthError("Please enter your Shop / Store Name.");
      return;
    }

    if (password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }

    setIsAuthenticating(true);

    try {
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpErr || !authData.user) {
        throw new Error(signUpErr?.message || "Registration failed. Check your email or password.");
      }

      // Provision new store record via API
      const regRes = await fetch("/api/store/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: authData.user.id,
          store_name: storeName.trim(),
          address: storeAddress.trim() || null,
        }),
      });

      const regJson = await regRes.json();
      if (!regRes.ok || !regJson.success) {
        throw new Error(regJson.error || "Failed to create store record.");
      }

      if (authData.session) {
        setSession(authData.session);
        setStore(regJson.store);
      } else {
        // Sign in to establish active session
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInData?.session) {
          setSession(signInData.session);
          setStore(regJson.store);
        } else {
          setAuthMode("login");
          setFeedbackMessage({
            type: "success",
            text: "Shop registered successfully! Please sign in with your password.",
          });
        }
      }
    } catch (err: any) {
      setAuthError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handle Logout
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setStore(null);
    setPrinters([]);
  };

  // Handle Printer Type Toggle
  const handleTogglePrinterType = (id: string) => {
    setPrinters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, type: p.type === "bw" ? "color" : "bw" } : p))
    );
  };

  // Handle Printer Online Toggle
  const handleTogglePrinterOnline = (id: string) => {
    setPrinters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_online: !p.is_online } : p))
    );
  };

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;

    setIsSaving(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch("/api/store/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: store.id,
          name: store.name,
          address: store.address,
          logo_url: store.logo_url,
          bw_price_per_page: store.bw_price_per_page,
          color_price_per_page: store.color_price_per_page,
          printers: printers,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setFeedbackMessage({
          type: "success",
          text: "Changes saved successfully! Customer web app and Windows terminal updated.",
        });
        if (json.store) setStore(json.store);
      } else {
        setFeedbackMessage({
          type: "error",
          text: json.error || "Failed to save changes. Please try again.",
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err.message || "An unexpected error occurred while saving.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/30 text-slate-900 pb-16">
      {/* Top Navigation Bar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to Customer Home"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-slate-900 tracking-tight">
                  Storekeeper Control Center
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-extrabold border border-indigo-100">
                  Admin Portal
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Manage per-page pricing, store branding, and printer color mapping
              </p>
            </div>
          </div>

          {session && (
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign Out of Storekeeper Admin"
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 pt-6">
        {loadingAuth ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" aria-hidden="true" />
            <p className="text-sm font-bold text-slate-600">Verifying Storekeeper Credentials...</p>
          </div>
        ) : !session ? (
          /* ================================================================= */
          /* STOREKEEPER LOGIN VIEW                                            */
          /* ================================================================= */
          <div className="max-w-md mx-auto pt-4 pb-12">
            <div className="bg-white rounded-3xl p-7 shadow-xl border border-slate-200/90 space-y-5">
              {/* Header */}
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
                  <Lock className="w-6 h-6" aria-hidden="true" />
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Storekeeper Portal
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {authMode === "login"
                    ? "Sign in to manage your shop's pricing, branding, and connected printers."
                    : "Register your shop PC and storekeeper account on Supabase backend."}
                </p>
              </div>

              {/* Tab Switcher */}
              <div className="grid grid-cols-2 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError(null);
                  }}
                  className={`py-2 text-xs font-black rounded-xl transition-all ${
                    authMode === "login"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError(null);
                  }}
                  className={`py-2 text-xs font-black rounded-xl transition-all ${
                    authMode === "register"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Register New Shop
                </button>
              </div>

              {authError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2 animate-shake"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="flex-1">{authError}</p>
                </div>
              )}

              {feedbackMessage && (
                <div
                  className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2 ${
                    feedbackMessage.type === "success"
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border border-rose-200 text-rose-800"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="flex-1">{feedbackMessage.text}</p>
                </div>
              )}

              {authMode === "login" ? (
                /* LOGIN FORM */
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label
                      htmlFor="admin-email"
                      className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1"
                    >
                      Storekeeper Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" aria-hidden="true" />
                      <input
                        id="admin-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="storekeeper@printinfinity.in"
                        className="min-h-[44px] w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-password"
                      className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" aria-hidden="true" />
                      <input
                        id="admin-password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="min-h-[44px] w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    aria-label="Log in to admin portal"
                    className="min-h-[48px] w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                  >
                    {isAuthenticating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                        <span>Sign In to Control Center</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* REGISTRATION FORM */
                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="register-store-name"
                      className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1"
                    >
                      Shop / Store Name
                    </label>
                    <div className="relative">
                      <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" aria-hidden="true" />
                      <input
                        id="register-store-name"
                        type="text"
                        required
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        placeholder="e.g. Apex Print &amp; Cyber Hub"
                        className="min-h-[44px] w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="register-address"
                      className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1"
                    >
                      Shop Address / Location
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" aria-hidden="true" />
                      <input
                        id="register-address"
                        type="text"
                        value={storeAddress}
                        onChange={(e) => setStoreAddress(e.target.value)}
                        placeholder="Shop 5, Main College Road"
                        className="min-h-[44px] w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="register-email"
                      className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1"
                    >
                      Storekeeper Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" aria-hidden="true" />
                      <input
                        id="register-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="storekeeper@printinfinity.in"
                        className="min-h-[44px] w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="register-password"
                        className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1"
                      >
                        Password
                      </label>
                      <input
                        id="register-password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="min-h-[44px] w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="register-confirm-password"
                        className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1"
                      >
                        Confirm
                      </label>
                      <input
                        id="register-confirm-password"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="min-h-[44px] w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    aria-label="Register new storekeeper account"
                    className="min-h-[48px] w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                  >
                    {isAuthenticating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                        <span>Registering Shop...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" aria-hidden="true" />
                        <span>Create Shop &amp; Storekeeper</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              <div className="text-center pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                Uses Supabase Auth backend • Syncs directly with your Windows Agent.
              </div>
            </div>
          </div>
        ) : (
          /* ================================================================= */
          /* STOREKEEPER MANAGEMENT DASHBOARD                                  */
          /* ================================================================= */
          <div className="space-y-6">
            {/* Notification Banner */}
            {feedbackMessage && (
              <div
                role="alert"
                aria-live="polite"
                className={`p-4 rounded-2xl border text-xs font-bold flex items-start gap-2.5 shadow-sm animate-fadeIn ${
                  feedbackMessage.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                {feedbackMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <p className="flex-1">{feedbackMessage.text}</p>
                <button
                  type="button"
                  onClick={() => setFeedbackMessage(null)}
                  aria-label="Dismiss message"
                  className="min-h-[44px] min-w-[44px] -my-2 -mr-2 flex items-center justify-center text-slate-600 hover:text-slate-900 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-lg"
                >
                  ✕
                </button>
              </div>
            )}

            {store && (
              <form onSubmit={handleSave} className="space-y-6">
                {/* SECTION 1: PER-PAGE PRICING */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                        ₹
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-slate-900">Per-Page Print Pricing</h2>
                        <p className="text-xs text-slate-500">
                          Configure live rates charged to customers per printed page
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                      Live Customer Rates
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* B&W Price */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="price-bw"
                          className="text-xs font-black text-slate-900 uppercase tracking-wider"
                        >
                          Black &amp; White (₹ / page)
                        </label>
                        <span className="text-[10px] font-bold text-slate-500">Default: ₹3.00</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-500">₹</span>
                        <input
                          id="price-bw"
                          type="number"
                          step="0.50"
                          min="0.50"
                          max="100.00"
                          required
                          value={store.bw_price_per_page}
                          onChange={(e) =>
                            setStore({
                              ...store,
                              bw_price_per_page: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="min-h-[44px] w-full pl-8 pr-3.5 py-2 rounded-xl border border-slate-300 text-sm font-black text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Preview: 10 B&amp;W pages ={" "}
                        <strong className="text-slate-900">
                          ₹{(store.bw_price_per_page * 10).toFixed(2)}
                        </strong>
                      </p>
                    </div>

                    {/* Color Price */}
                    <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="price-color"
                          className="text-xs font-black text-indigo-950 uppercase tracking-wider"
                        >
                          Full Color (₹ / page)
                        </label>
                        <span className="text-[10px] font-bold text-indigo-600">Default: ₹10.00</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-500">₹</span>
                        <input
                          id="price-color"
                          type="number"
                          step="0.50"
                          min="0.50"
                          max="500.00"
                          required
                          value={store.color_price_per_page}
                          onChange={(e) =>
                            setStore({
                              ...store,
                              color_price_per_page: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="min-h-[44px] w-full pl-8 pr-3.5 py-2 rounded-xl border border-indigo-200 text-sm font-black text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                      <p className="text-[11px] text-indigo-900">
                        Preview: 10 Color pages ={" "}
                        <strong className="text-indigo-950">
                          ₹{(store.color_price_per_page * 10).toFixed(2)}
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: STORE BRANDING & INFO */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Store className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-slate-900">Store Branding &amp; Details</h2>
                        <p className="text-xs text-slate-500">
                          Shown on customer mobile headers, receipts, and order tracker
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Store Name */}
                    <div>
                      <label
                        htmlFor="store-name"
                        className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1"
                      >
                        Store Name
                      </label>
                      <input
                        id="store-name"
                        type="text"
                        required
                        value={store.name}
                        onChange={(e) => setStore({ ...store, name: e.target.value })}
                        className="min-h-[44px] w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>

                    {/* Store Address */}
                    <div>
                      <label
                        htmlFor="store-address"
                        className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1"
                      >
                        Store Location / Counter Address
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" aria-hidden="true" />
                        <input
                          id="store-address"
                          type="text"
                          value={store.address || ""}
                          onChange={(e) => setStore({ ...store, address: e.target.value })}
                          placeholder="e.g. Shop 12, Commercial Arcade, Ground Floor"
                          className="min-h-[44px] w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                    </div>

                    {/* Logo URL */}
                    <div>
                      <label
                        htmlFor="store-logo"
                        className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1"
                      >
                        Custom Logo URL (Optional)
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-black border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          <img
                            src={store.logo_url || "/logo.png"}
                            alt="Logo preview"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex-1">
                          <input
                            id="store-logo"
                            type="url"
                            value={store.logo_url || ""}
                            onChange={(e) => setStore({ ...store, logo_url: e.target.value })}
                            placeholder="https://example.com/logo.png (leave blank for default)"
                            className="min-h-[44px] w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: PRINTER HARDWARE & COLOR MAPPING */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                        <Printer className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-slate-900">Configured Printer Hardware</h2>
                        <p className="text-xs text-slate-500">
                          Toggle whether each physical printer handles Black &amp; White or Color jobs
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {printers.length} {printers.length === 1 ? "printer" : "printers"} registered
                    </span>
                  </div>

                  {printers.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                      No printers currently registered. Open your Print Infinity Windows app to pair your local printers.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {printers.map((p) => (
                        <div
                          key={p.id}
                          className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-slate-900">
                                {p.name || p.windows_printer_name}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.is_online
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {p.is_online ? "Online" : "Offline"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono truncate max-w-sm">
                              Windows: {p.windows_printer_name} • {p.connection || "USB"}
                            </p>
                          </div>

                          <div className="flex items-center gap-2.5">
                            {/* Color Mode Switcher */}
                            <button
                              type="button"
                              onClick={() => handleTogglePrinterType(p.id)}
                              aria-label={`Toggle mode for ${p.name}. Currently ${p.type === "color" ? "Color" : "Black & White"}`}
                              className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                                p.type === "color"
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                  : "bg-slate-900 text-white border-slate-900 shadow-xs"
                              }`}
                            >
                              <span>{p.type === "color" ? "🎨 Color Printer" : "⚫ B&W Printer"}</span>
                              <span className="text-[10px] opacity-75">(click to switch)</span>
                            </button>

                            {/* Online / Offline Switcher */}
                            <button
                              type="button"
                              onClick={() => handleTogglePrinterOnline(p.id)}
                              aria-label={`Toggle online status for ${p.name}`}
                              className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                                p.is_online
                                  ? "bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                              }`}
                            >
                              {p.is_online ? "Active" : "Disabled"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SAVE ACTION BUTTON */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    aria-label="Save all store settings"
                    className="min-h-[50px] px-7 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-lg transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" aria-hidden="true" />
                        <span>Save Store Settings &amp; Rates</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
