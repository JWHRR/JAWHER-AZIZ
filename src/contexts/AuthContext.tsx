import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AppRole } from "@/lib/types";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// How long to wait for profile/roles before giving up and letting the app render anyway.
const LOAD_TIMEOUT_MS = 6000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Track whether initial load is done so onAuthStateChange never re-triggers setLoading
  const initialLoadDone = useRef(false);
  // Prevent concurrent loadUserData calls (e.g. onAuthStateChange + getSession both fire)
  const loadingUserData = useRef(false);

  const loadUserData = async (uid: string) => {
    if (loadingUserData.current) return; // deduplicate concurrent calls
    loadingUserData.current = true;

    // Safety net: if queries hang on a poor mobile connection, unblock after timeout
    const timeoutId = setTimeout(() => {
      console.warn("loadUserData timed out — unblocking app render");
      loadingUserData.current = false;
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    }, LOAD_TIMEOUT_MS);

    try {
      const [{ data: profileData }, { data: rolesData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);

      clearTimeout(timeoutId);

      // Block deactivated accounts
      if (profileData && (profileData as any).is_active === false) {
        await supabase.auth.signOut();
        setProfile(null);
        setRoles([]);
        return;
      }
      setProfile(profileData as Profile | null);
      setRoles(((rolesData ?? []) as { role: AppRole }[]).map((r) => r.role));
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Error loading user data:", err);
      // Don't leave the app stuck — proceed with null profile/roles
    } finally {
      loadingUserData.current = false;
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // 1. Set up auth state listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (!newSession?.user) {
        setProfile(null);
        setRoles([]);
        // If we were still in initial load, unblock
        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
          setLoading(false);
        }
      }
      // Note: we do NOT call loadUserData here to avoid racing with getSession below.
      // loadUserData is called once from getSession.then() on initial mount.
      // Subsequent auth events (token refresh etc.) don't need to reload profile/roles.
    });

    // 2. Check for existing session — single source of truth for initial load
    supabase.auth.getSession()
      .then(({ data: { session: existing } }) => {
        setSession(existing);
        setUser(existing?.user ?? null);
        if (existing?.user) {
          // loadUserData sets loading=false in its finally block
          loadUserData(existing.user.id);
        } else {
          if (!initialLoadDone.current) {
            initialLoadDone.current = true;
            setLoading(false);
          }
        }
      })
      .catch((err) => {
        console.error("Error fetching session:", err);
        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
          setLoading(false);
        }
      });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refresh = async () => {
    if (user) {
      loadingUserData.current = false; // allow re-fetch on manual refresh
      await loadUserData(user.id);
    }
  };

  // Priority: ADMIN > TECHNICIEN > RESPONSABLE_RESTAURANT > SURVEILLANT
  const primaryRole: AppRole | null = roles.includes("ADMIN")
    ? "ADMIN"
    : roles.includes("TECHNICIEN")
    ? "TECHNICIEN"
    : roles.includes("RESPONSABLE_RESTAURANT")
    ? "RESPONSABLE_RESTAURANT"
    : roles.includes("SURVEILLANT")
    ? "SURVEILLANT"
    : null;

  return (
    <AuthContext.Provider value={{ user, session, profile, roles, primaryRole, loading, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
