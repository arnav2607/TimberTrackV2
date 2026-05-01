import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TreePine, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { formatErr } from "@/lib/api";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    password: "",
    company_name: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.username || !form.password || !form.company_name)
      return toast.error("Fill all fields");
    if (form.password.length < 4) return toast.error("Password too short");
    setLoading(true);
    try {
      await signup(form);
      toast.success("Account created");
      navigate("/");
    } catch (err) {
      toast.error(formatErr(err?.response?.data?.detail) || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
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
              Built for the yard.<br /> Loved by accountants.
            </h1>
            <p className="text-white/80 text-lg max-w-md">
              Massive buttons. Live calculations. Excel-ready reports.
            </p>
          </div>
          <div />
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-white">
        <form
          onSubmit={submit}
          className="w-full max-w-md space-y-5"
          data-testid="signup-form"
        >
          <div className="md:hidden flex items-center gap-3 mb-2">
            <div className="brand-grad w-12 h-12 rounded-xl flex items-center justify-center text-white">
              <TreePine className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div className="font-bold text-2xl">TimberLog</div>
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Create account
            </h2>
            <p className="text-slate-600 mt-2">It only takes a minute.</p>
          </div>

          {[
            { k: "full_name", label: "Full Name", placeholder: "Ravi Kumar", testid: "signup-fullname" },
            { k: "company_name", label: "Company Name", placeholder: "Acme Timbers", testid: "signup-company" },
            { k: "username", label: "Username", placeholder: "ravi_k", testid: "signup-username" },
          ].map((f) => (
            <div className="space-y-2" key={f.k}>
              <Label className="text-sm uppercase tracking-wider font-semibold text-slate-700">
                {f.label}
              </Label>
              <Input
                data-testid={f.testid}
                value={form[f.k]}
                onChange={set(f.k)}
                placeholder={f.placeholder}
                className="h-14 text-lg border-2 border-slate-300 rounded-md"
                autoCapitalize="none"
              />
            </div>
          ))}

          <div className="space-y-2">
            <Label className="text-sm uppercase tracking-wider font-semibold text-slate-700">
              Password
            </Label>
            <Input
              type="password"
              data-testid="signup-password"
              value={form.password}
              onChange={set("password")}
              placeholder="••••••••"
              className="h-14 text-lg border-2 border-slate-300 rounded-md"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            data-testid="signup-submit"
            className="w-full h-16 text-lg rounded-xl bg-[#064E3B] hover:bg-[#047857] text-white font-bold"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <UserPlus className="w-5 h-5 mr-2" />
            )}
            Create account
          </Button>

          <div className="text-center text-slate-600">
            Already have one?{" "}
            <Link
              to="/login"
              className="text-emerald-800 font-semibold underline"
              data-testid="goto-login"
            >
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
