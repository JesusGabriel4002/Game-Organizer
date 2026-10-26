import { getDb, exportBackup } from "./db";
import { files } from "./api";
import { getSupabase, hydrateSecureSession, isSupabaseConfigured } from "./supabase";
import { getSyncedUserId, markSyncedUser, syncNow, uploadLocalLibrary } from "./sync";
import { setApplying, setSyncMeta } from "./sync-meta";
import { nowIso } from "./utils";

export type AuthUser = { id: string; email: string | null };

export async function initAuth(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured()) return null;
  await hydrateSecureSession();
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  return user ? { id: user.id, email: user.email ?? null } : null;
}

function authErrorMessage(error: { message?: string; code?: string; status?: number }, kind: "signin" | "signup") {
  const raw = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();

  if (raw.includes("already registered") || code === "user_already_exists") {
    return "Esse e-mail já tem conta. Use Entrar.";
  }
  if (raw.includes("invalid login") || raw.includes("invalid credentials") || code === "invalid_credentials") {
    return "E-mail ou senha incorretos.";
  }
  if (raw.includes("email") && raw.includes("invalid")) {
    return "E-mail inválido.";
  }
  if (raw.includes("password") && (raw.includes("weak") || raw.includes("least") || raw.includes("short"))) {
    return "Senha fraca demais. Use pelo menos 8 caracteres.";
  }
  if (raw.includes("leaked") || raw.includes("pwned") || code === "weak_password") {
    return "Essa senha é muito comum ou vazou em outros sites. Escolha outra.";
  }
  if (raw.includes("signup") && raw.includes("disabled")) {
    return "Cadastro de novas contas está desativado no projeto.";
  }
  if (raw.includes("rate") || error.status === 429) {
    return "Muitas tentativas. Aguarde um minuto e tente de novo.";
  }
  if (raw.includes("failed to fetch") || raw.includes("network")) {
    return "Sem conexão com o servidor. Verifique a internet.";
  }
  if (kind === "signin") return "E-mail ou senha incorretos.";
  return error.message?.trim() || "Não foi possível criar a conta. Tente de novo.";
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(authErrorMessage(error, "signin"));
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function signUp(email: string, password: string) {
  if (password.length < 8) throw new Error("A senha precisa ter no mínimo 8 caracteres.");
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) {
    console.error("[auth] signUp failed", error);
    throw new Error(authErrorMessage(error, "signup"));
  }
  return {
    user: data.user ? { id: data.user.id, email: data.user.email ?? null } : null,
    needsConfirmation: !data.session,
  };
}

export async function signOut() {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabase();
  await supabase.auth.signOut();
}

export async function clearLocalLibrary() {
  const db = await getDb();
  await setApplying(true);
  try {
    await db.execute("DELETE FROM sync_outbox");
    await db.execute("DELETE FROM user_game_categories");
    await db.execute("DELETE FROM goals");
    await db.execute("DELETE FROM user_games");
    await db.execute("DELETE FROM categories");
    await db.execute("DELETE FROM games");
    await setSyncMeta("user_id", "");
    for (const t of ["games", "categories", "user_games", "user_game_categories", "goals"]) {
      await setSyncMeta(`cursor_${t}`, "1970-01-01T00:00:00.000Z");
    }
  } finally {
    await setApplying(false);
  }
}

export async function replaceWithCloudLibrary() {
  // Soft-wipe local rows then pull everything for this account.
  await clearLocalLibrary();
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) await markSyncedUser(data.session.user.id);
  await syncNow({ force: true });
}

export async function mergeWithCloudLibrary(userId: string) {
  await markSyncedUser(userId);
  await uploadLocalLibrary();
}

export async function afterLogin(user: AuthUser): Promise<"uploaded" | "pulled" | "needs_choice" | "noop"> {
  const previous = await getSyncedUserId();
  if (!previous) {
    await markSyncedUser(user.id);
    const db = await getDb();
    const games = await db.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM user_games WHERE deleted_at IS NULL");
    if ((games[0]?.n ?? 0) > 0) {
      await uploadLocalLibrary();
      return "uploaded";
    }
    await syncNow({ force: true });
    return "pulled";
  }
  if (previous === user.id) {
    await syncNow({ force: true });
    return "noop";
  }
  // Different account — caller must ask merge vs replace.
  return "needs_choice";
}

export async function writeAutoBackup(path: string) {
  const backup = await exportBackup();
  await files.write(path, JSON.stringify(backup, null, 2));
}

export async function deleteCloudAccount(password: string) {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session?.user?.email) throw new Error("Sessão inválida.");

  // Re-auth to confirm password without leaking details.
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: session.user.email,
    password,
  });
  if (authError) throw new Error("Senha incorreta.");

  const { data: refreshed } = await supabase.auth.getSession();
  const token = refreshed.session?.access_token;
  if (!token) throw new Error("Sessão inválida.");

  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const res = await fetch(`${url}/functions/v1/delete-account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
  });
  if (!res.ok) {
    throw new Error("Não foi possível excluir a conta. Tente de novo mais tarde.");
  }
  await clearLocalLibrary();
  await signOut();
}

export { nowIso };
