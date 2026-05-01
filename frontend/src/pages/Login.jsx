import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TreePine, LogIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { formatErr } from "@/lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!u || !p) return toast.error("Fill all fields");
    setLoading(true);
    try {
      await login(u, p);
      toast.success("Welcome back!");
      navigate("/");
    } catch (err) {
      toast.error(formatErr(err?.response?.data?.detail) || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left: image */}
      <div
        className="hidden md:block relative"
        style={{
          backgroundImage:
            "linear-gradient(120deg, rgba(6,78,59,.85), rgba(6,78,59,.55)), url('https://images.unsplash.com/photo-1513512995101-b6395de758b0?crop=entropy&cs=srgb&fm=jpg&q=85')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 grain opacity-30" />
        <div className="relative h-full p-12 flex flex-col justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <TreePine className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div className="font-bold text-2xl tracking-tight">TimberLog</div>
          </div>
          <div>
            <h1 className="text-4xl lg:text-5xl font-bold leading-[1.05] mb-4">
              Track every log.<br /> From port to plank.
            </h1>
            <p className="text-white/80 text-lg max-w-md">
              Record bills of lading, measure each log, and export crisp Excel
              reports — built for the yard.
            </p>
          </div>
          <div className="text-white/70 text-sm">
            © {new Date().getFullYear()} TimberLog
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-white">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md space-y-6"
          data-testid="login-form"
        >
          <div className="md:hidden flex items-center gap-3 mb-2">
            <div className="brand-grad w-12 h-12 rounded-xl flex items-center justify-center text-white">
              <TreePine className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div className="font-bold text-2xl">TimberLog</div>
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Sign in
            </h2>
            <p className="text-slate-600 mt-2">
              Enter your details to continue.
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm uppercase tracking-wider font-semibold text-slate-700">
              Username
            </Label>
            <Input
              data-testid="login-username"
              value={u}
              onChange={(e) => setU(e.target.value)}
              placeholder="your_username"
              className="h-14 text-lg border-2 border-slate-300 rounded-md"
              autoCapitalize="none"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm uppercase tracking-wider font-semibold text-slate-700">
              Password
            </Label>
            <Input
              data-testid="login-password"
              type="password"
              value={p}
              onChange={(e) => setP(e.target.value)}
              placeholder="••••••••"
              className="h-14 text-lg border-2 border-slate-300 rounded-md"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            data-testid="login-submit"
            className="w-full h-16 text-lg rounded-xl bg-[#064E3B] hover:bg-[#047857] text-white font-bold"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <LogIn className="w-5 h-5 mr-2" />
            )}
            Sign in
          </Button>

          <div className="text-center text-slate-600">
            New here?{" "}
            <Link
              to="/signup"
              className="text-emerald-800 font-semibold underline"
              data-testid="goto-signup"
            >
              Create an account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
