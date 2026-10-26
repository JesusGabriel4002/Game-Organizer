import { useState } from "react";
import { afterLogin, signIn, signUp, type AuthUser } from "@/lib/account";
import { isSupabaseConfigured } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";

type Mode = "signin" | "signup";

export function AuthDialog({
  open,
  onOpenChange,
  onSignedIn,
  onNeedsAccountChoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignedIn: (user: AuthUser) => void;
  onNeedsAccountChoice: (user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured()) return null;

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "signin") {
        const user = await signIn(email, password);
        const result = await afterLogin(user);
        if (result === "needs_choice") onNeedsAccountChoice(user);
        else {
          if (result === "uploaded") toast.info("Biblioteca enviada para a nuvem.");
          else if (result === "pulled") toast.info("Dados da conta baixados.");
          onSignedIn(user);
        }
        onOpenChange(false);
      } else {
        const { user, needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          toast.info("Confirme o e-mail que enviamos e depois entre na conta.");
          setMode("signin");
        } else if (user) {
          const result = await afterLogin(user);
          if (result === "needs_choice") onNeedsAccountChoice(user);
          else onSignedIn(user);
          onOpenChange(false);
        }
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{mode === "signin" ? "Entrar" : "Criar conta"}</DialogTitle>
        <DialogDescription className="mt-1">
          {mode === "signin"
            ? "Entre para sincronizar sua biblioteca entre aparelhos."
            : "Crie uma conta com e-mail e senha (mínimo 8 caracteres)."}
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-1">
            <Label htmlFor="auth-email">E-mail</Label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="auth-password">Senha</Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Criar conta" : "Já tenho conta"}
            </button>
            <Button type="submit" variant="default" disabled={busy}>
              {busy ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
