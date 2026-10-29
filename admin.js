
/* CSS Skoolsport — secure admin authentication */

(() => {
  "use strict";

  const config = window.CSS_CONFIG || {};
  const message = document.getElementById("login-message");
  const form = document.getElementById("admin-login-form");
  const button = document.getElementById("admin-login-button");

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
  }

  if (
    !window.supabase ||
    !config.SUPABASE_URL ||
    !config.SUPABASE_PUBLISHABLE_KEY ||
    config.SUPABASE_PUBLISHABLE_KEY === "PASTE_YOUR_PUBLISHABLE_KEY_HERE"
  ) {
    showMessage("The login service is not configured. Please contact the site administrator.", true);
    button.disabled = true;
    return;
  }

  const db = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY
  );

  async function isAuthorisedAdmin(userId) {
    const { data, error } = await db
      .from("css_admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Admin authorisation check failed:", error);
      throw new Error("Could not verify administrator access. Please try again.");
    }

    return Boolean(data);
  }

  async function redirectIfAdmin(user) {
    if (!user) return false;

    try {
      const authorised = await isAuthorisedAdmin(user.id);

      if (authorised) {
        window.location.replace("/dashboard.html");
        return true;
      }

      await db.auth.signOut();
      showMessage("This account is not authorised to access the admin dashboard.", true);
      return false;
    } catch (error) {
      showMessage(error.message || "Could not verify access.", true);
      return false;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-password").value;

    button.disabled = true;
    button.textContent = "Signing in…";
    showMessage("");

    try {
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw new Error("Sign-in failed. Check your email and password.");
      }

      const authorised = await isAuthorisedAdmin(data.user.id);

      if (!authorised) {
        await db.auth.signOut();
        throw new Error("This account is not authorised to access the admin dashboard.");
      }

      showMessage("Login successful. Opening dashboard…");
      window.location.replace("/dashboard.html");
    } catch (error) {
      showMessage(error.message || "Unable to sign in. Please try again.", true);
    } finally {
      button.disabled = false;
      button.textContent = "Sign in securely";
    }
  });

  db.auth.getSession().then(async ({ data, error }) => {
    if (error) {
      console.error("Could not check existing session:", error);
      return;
    }

    if (data.session) {
      await redirectIfAdmin(data.session.user);
    }
  });
})();
