
/* CSS Skoolsport — administrator dashboard */

(() => {
  "use strict";

  const config = window.CSS_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  const db = window.supabase?.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY
  );

  let adminReady = false;

  const escapeHTML = (value = "") =>
    String(value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  function message(id, text, error = false) {
    const element = $(id);
    if (!element) return;
    element.textContent = text;
    element.classList.toggle("error", error);
  }

  function setBusy(form, busy) {
    form.querySelectorAll("button[type='submit']").forEach((button) => {
      button.disabled = busy;
    });
  }

  function requireAdmin() {
    if (!adminReady) {
      throw new Error("Your administrator access has not been verified.");
    }
  }

  async function verifyAdmin() {
    if (!db) {
      throw new Error("The database is not configured. Check config.js.");
    }

    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError) throw sessionError;

    const user = sessionData.session?.user;

    if (!user) {
      window.location.replace("/admin.html");
      return false;
    }

    const { data, error } = await db
      .from("css_admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      await db.auth.signOut();
      window.location.replace("/admin.html");
      return false;
    }

    adminReady = true;
    $("dashboard-status").textContent = "Administrator verified";
    return true;
  }

  function renderMatch(item) {
    return `
      <article class="dash-item">
        <h3>${escapeHTML(item.age_group)} ${escapeHTML(item.sport)}</h3>
        <p>CSS ${escapeHTML(item.home_score ?? "–")} – ${escapeHTML(item.away_score ?? "–")}
          ${escapeHTML(item.opponent)}</p>
        <p>${escapeHTML(item.status)} · ${escapeHTML(item.venue || "Venue TBC")}</p>
        <p>${escapeHTML(item.match_date || "Date to be confirmed")}</p>
      </article>`;
  }

  async function loadMatches() {
    const { data, error } = await db
      .from("css_fixtures")
      .select("*")
      .order("match_date", { ascending: false, nullsFirst: false });

    if (error) throw error;

    $("admin-matches").innerHTML = data?.length
      ? data.map(renderMatch).join("")
      : "<p>No matches published yet.</p>";
  }

  async function loadNews() {
    const { data, error } = await db
      .from("css_news")
      .select("*")
      .order("published_at", { ascending: false });

    if (error) throw error;

    $("admin-news").innerHTML = data?.length
      ? data.map((item) => `
          <article class="dash-item">
            <h3>${escapeHTML(item.title)}</h3>
            <p>${escapeHTML(item.body)}</p>
            <p>${escapeHTML(item.published_at || "")}</p>
          </article>`).join("")
      : "<p>No news published yet.</p>";
  }

  async function loadGallery() {
    const { data, error } = await db
      .from("css_gallery")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    $("admin-gallery").innerHTML = data?.length
      ? data.map((item) => `
          <article class="dash-item">
            <h3>${escapeHTML(item.title || "Sports photograph")}</h3>
            ${item.image_url ? `
              <img src="${escapeHTML(item.image_url)}"
                   alt="${escapeHTML(item.title || "Sports photograph")}"
                   loading="lazy"
                   style="width:100%;max-width:360px;border-radius:12px">
            ` : ""}
            <p>Image uploaded</p>
          </article>`).join("")
      : "<p>No photographs uploaded yet.</p>";
  }

  $("match-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(form, true);
    message("match-message", "Saving match…");

    try {
      requireAdmin();

      const home = $("match-home-score").value;
      const away = $("match-away-score").value;
      const status = $("match-status").value;

      if ((home === "") !== (away === "")) {
        throw new Error("Enter both scores, or leave both scores blank.");
      }

      if (status === "Completed" && (home === "" || away === "")) {
        throw new Error("A completed match needs both scores.");
      }

      const match = {
        sport: $("match-sport").value,
        age_group: $("match-age").value.trim(),
        opponent: $("match-opponent").value.trim(),
        match_date: $("match-date").value
          ? new Date($("match-date").value).toISOString()
          : null,
        status,
        venue: $("match-venue").value.trim() || null,
        home_score: home === "" ? null : Number(home),
        away_score: away === "" ? null : Number(away),
        notes: $("match-notes").value.trim() || null
      };

      const { error } = await db.from("css_fixtures").insert(match);
      if (error) throw error;

      form.reset();
      message("match-message", "Match saved successfully.");
      await loadMatches();
    } catch (error) {
      console.error(error);
      message("match-message", error.message || "Could not save match.", true);
    } finally {
      setBusy(form, false);
    }
  });

  $("news-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(form, true);
    message("news-message", "Publishing news…");

    try {
      requireAdmin();

      const { error } = await db.from("css_news").insert({
        title: $("news-title").value.trim(),
        body: $("news-body").value.trim(),
        published_at: new Date().toISOString()
      });

      if (error) throw error;

      form.reset();
      message("news-message", "News published successfully.");
      await loadNews();
    } catch (error) {
      console.error(error);
      message("news-message", error.message || "Could not publish news.", true);
    } finally {
      setBusy(form, false);
    }
  });

  $("gallery-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(form, true);
    message("gallery-message", "Uploading photograph…");

    try {
      requireAdmin();

      const file = $("gallery-file").files[0];
      const title = $("gallery-title").value.trim();

      if (!file) throw new Error("Choose a photograph first.");

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Use a JPG, PNG or WebP image.");
      }

      if (file.size > 8 * 1024 * 1024) {
        throw new Error("The image must be 8 MB or smaller.");
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await db.storage
        .from("css-gallery")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = db.storage
        .from("css-gallery")
        .getPublicUrl(path);

      const { error: rowError } = await db.from("css_gallery").insert({
        title,
        image_url: urlData.publicUrl
      });

      if (rowError) {
        throw new Error(
          "The image uploaded, but its gallery record could not be saved. Check database permissions."
        );
      }

      form.reset();
      message("gallery-message", "Photograph uploaded successfully.");
      await loadGallery();
    } catch (error) {
      console.error(error);
      message("gallery-message", error.message || "Could not upload photograph.", true);
    } finally {
      setBusy(form, false);
    }
  });

  $("stream-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(form, true);
    message("stream-message", "Saving stream settings…");

    try {
      requireAdmin();

      const rawURL = $("stream-url-input").value.trim();
      let streamURL = null;

      if (rawURL) {
        const parsed = new URL(rawURL);

        if (!["https:", "http:"].includes(parsed.protocol)) {
          throw new Error("Enter a valid HTTPS or HTTP stream link.");
        }

        streamURL = parsed.href;
      }

      const { error } = await db
        .from("css_settings")
        .upsert(
          { key: "stream_url", value: streamURL },
          { onConflict: "key" }
        );

      if (error) throw error;

      message(
        "stream-message",
        streamURL ? "Stream link saved." : "Stream link cleared."
      );
    } catch (error) {
      console.error(error);
      message("stream-message", error.message || "Could not save stream link.", true);
    } finally {
      setBusy(form, false);
    }
  });

  $("logout-button").addEventListener("click", async () => {
    $("logout-button").disabled = true;

    try {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      window.location.replace("/admin.html");
    } catch (error) {
      console.error(error);
      $("dashboard-status").textContent = "Sign-out failed. Please try again.";
      $("logout-button").disabled = false;
    }
  });

  async function init() {
    try {
      const authorised = await verifyAdmin();
      if (!authorised) return;

      const results = await Promise.allSettled([
        loadMatches(),
        loadNews(),
        loadGallery()
      ]);

      const failed = results.some((result) => result.status === "rejected");

      if (failed) {
        $("dashboard-status").textContent =
          "Signed in; some lists could not load";
        results.forEach((result) => {
          if (result.status === "rejected") console.error(result.reason);
        });
      }
    } catch (error) {
      console.error(error);
      $("dashboard-status").textContent = "Access check failed";
      window.location.replace("/admin.html");
    }
  }

  init();
})();
