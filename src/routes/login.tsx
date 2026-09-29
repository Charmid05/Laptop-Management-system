import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/kit";
import { login } from "@/lib/auth";
import { meta } from "@/lib/meta";
import { useDB } from "@/services/store";

export const Route = createFileRoute("/login")({
  head: () => meta("Sign in", "Sign in to the Amani Eye practice management system."),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const db = useDB();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(username, password)) navigate({ to: "/" });
    else setError("Incorrect username or password.");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-12 text-ink-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand"><Eye className="size-5" /></span>
          <span className="font-display text-xl font-extrabold">{db.settings.practiceName}</span>
        </div>
        <div>
          <h1 className="text-5xl leading-tight">Every patient,<br />every lens,<br /><span className="text-accent">in one place.</span></h1>
          <p className="mt-4 max-w-md opacity-70">Registration, eye exams, prescriptions, billing, insurance and stock for your optometry practice.</p>
        </div>
        <p className="text-xs opacity-50">{db.settings.address}, {db.settings.town}</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-3xl">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use your staff username and password.</p>
          </div>
          <Field label="Username or email"><Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus /></Field>
          <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full rounded-full">Sign in</Button>
          <div className="rounded-xl border bg-muted p-4 text-xs text-muted-foreground">
            <p className="mb-2 font-semibold text-foreground">Demo accounts (any password, 4+ characters)</p>
            <div className="grid grid-cols-2 gap-1">
              {db.users.filter((u) => u.status === "active").map((u) => (
                <button type="button" key={u.id} className="text-left hover:text-foreground" onClick={() => { setUsername(u.username); setPassword("demo1234"); }}>
                  <span className="font-mono">{u.username}</span> · {db.roles.find((r) => r.id === u.role)?.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
