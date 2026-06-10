import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
  });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const redirectUrl = sessionStorage.getItem("redirectUrl") || "/bootstrap";
      sessionStorage.removeItem("redirectUrl");
      navigate(redirectUrl);
    }

    setLoading(false);
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Enter the same password in both fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/bootstrap`,
        data: { full_name: formData.fullName },
      },
    });

    if (error) {
      toast({
        title: "Account creation failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Confirm your email",
        description: "We sent a confirmation link to your inbox.",
      });
    }

    setLoading(false);
  };

  return (
    <AuthShell
      eyebrow={isLogin ? "Agency sign in" : "Create workspace"}
      title={isLogin ? "Return to your operating system." : "Set up your agency control layer."}
      description={
        isLogin
          ? "Access client context, approvals, AI setup, and delivery state from one governed workspace."
          : "Create the workspace your team will use to run governed AI across every client account."
      }
    >
      {isLogin ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="owner@agency.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
          <Button type="button" variant="link" className="w-full" onClick={() => navigate("/forgot-password")} disabled={loading}>
            Forgot password?
          </Button>
          <Separator />
          <Button type="button" variant="outline" className="w-full" onClick={() => setIsLogin(false)} disabled={loading}>
            Create an account
          </Button>
        </form>
      ) : (
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Maya Chen"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
              disabled={loading}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signupEmail">Email</Label>
            <Input
              id="signupEmail"
              type="email"
              placeholder="owner@agency.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signupPassword">Password</Label>
            <Input
              id="signupPassword"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              disabled={loading}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              disabled={loading}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            Create account
          </Button>
          <Separator />
          <Button type="button" variant="outline" className="w-full" onClick={() => setIsLogin(true)} disabled={loading}>
            Already have an account? Sign in
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
