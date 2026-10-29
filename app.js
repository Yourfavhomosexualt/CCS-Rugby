
/* CSS Skoolsport — public website functionality */

(() => {
  "use strict";

  const config = window.CSS_CONFIG || {};
  const url = config.SUPABASE_URL;
  const key = config.SUPABASE_PUBLISHABLE_KEY;

  const $ = (selector) => document.querySelector(selector);

  const escapeHTML = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const formatDate = (value) => {
    if (!value) return "Date to be confirmed";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date to be confirmed";

    return new Intl.DateTimeFormat("en-ZA", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  };

  const card = (content) =>
    `<article class="card">${content}</article>`;

  const showMessage = (selector, message) => {
    const element = $(selector);
    if (element) element.innerHTML = card(escapeHTML(message));
  };

  const renderMatch = (match) => {
    const status = escapeHTML(match.status || "Upcoming");
    const live = ["Live", "Half-time"].includes(match.status);
    const homeScore = match.home_score ?? "–";
    const awayScore = match.away_score ?? "–";

    return card(`
      <div class="match-topline">
        <span class="eyebrow">${escapeHTML(match.sport)}</span>
        <span class="status ${live ? "live" : ""}">${status}</span>
      </div>
      <h3>${escapeHTML(match.age_group || "Open")} ${escapeHTML(match.sport)}</h3>
      <div class="match-score">
        <div>
          <strong>CSS</strong>
          <div class="score">${escapeHTML(homeScore)}</div>
        </div>
        <div class="muted">VS</div>
        <div style="text-align:right">
          <strong>${escapeHTML(match.opponent)}</strong>
          <div class="score">${escapeHTML(awayScore)}</div>
        </div>
      </div>
      <p class="muted">${escapeHTML(match.venue || "Venue to be confirmed")}</p>
      <p class="muted">${escapeHTML(formatDate(match.match_date))}</p>
      ${match.notes ? `<p>${escapeHTML(match.notes)}</p>` : ""}
    `);
  };

  const renderNews = (item) => card(`
    <span class="eyebrow">CSS Skoolsport News</span>
    <h3>${escapeHTML(item.title)}</h3>
    <p>${escapeHTML(item.body)}</p>
    <p class="muted">${escapeHTML(formatDate(item.published_at))}</p>
  `);

  const renderGallery = (item) => card(`
    ${item.image_url ? `
      <img
        src="${escapeHTML(item.image_url)}"
        alt="${escapeHTML(item.title || "CSS Skoolsport sports photograph")}"
        loading="lazy"
        style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px"
      >
    ` : ""}
    <h3>${escapeHTML(item.title || "CSS Skoolsport")}</h3>
  `);

  async function loadMatches(db) {
    const targets = {
      live: "#live-matches",
      results: "#results",
      upcoming: "#upcoming"
    };

    try {
      const { data, error } = await db
        .from("css_fixtures")
        .select("*")
        .order("match_date", { ascending: true, nullsFirst: false });

      if (error) throw error;

      const matches = data || [];
      const live = matches.filter((m) =>
        ["Live", "Half-time"].includes(m.status)
      );
      const results = matches.filter((m) => m.status === "Completed");
      const upcoming = matches.filter((m) =>
        ["Upcoming", "Postponed"].includes(m.status)
      );

      $(targets.live).innerHTML = live.length
        ? live.map(renderMatch).join("")
        : card("<h3>No live matches right now</h3><p class='muted'>Check the fixtures and recent results below.</p>");

      $(targets.results).innerHTML = results.length
        ? [...results].reverse().map(renderMatch).join("")
        : card("<h3>No completed matches yet</h3>");

      $(targets.upcoming).innerHTML = upcoming.length
        ? upcoming.map(renderMatch).join("")
        : card("<h3>No upcoming fixtures published yet</h3>");

      const updated = $("#last-updated");
      if (updated) {
        updated.textContent = `Updated ${new Date().toLocaleTimeString("en-ZA", {
          hour: "2-digit",
          minute: "2-digit"
        })}`;
      }
    } catch (error) {
      console.error("CSS Skoolsport: unable to load fixtures", error);
      showMessage(targets.live, "Scores could not load. Please try again later.");
      showMessage(targets.results, "Previous results could not load.");
      showMessage(targets.upcoming, "Fixtures could not load.");
    }
  }

  async function loadNews(db) {
    try {
      const { data, error } = await db
        .from("css_news")
        .select("*")
        .order("published_at", { ascending: false });

      if (error) throw error;

      $("#news-list").innerHTML = data?.length
        ? data.map(renderNews).join("")
        : card("<h3>No news published yet</h3><p class='muted'>Sports announcements will appear here.</p>");
    } catch (error) {
      console.error("CSS Skoolsport: unable to load news", error);
      showMessage("#news-list", "Sports news could not load.");
    }
  }

  async function loadGallery(db) {
    try {
      const { data, error } = await db
        .from("css_gallery")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      $("#gallery-list").innerHTML = data?.length
        ? data.map(renderGallery).join("")
        : card("<h3>Gallery coming soon</h3><p class='muted'>Sports photographs will appear here.</p>");
    } catch (error) {
      console.error("CSS Skoolsport: unable to load gallery", error);
      showMessage("#gallery-list", "Gallery photographs could not load.");
    }
  }

  async function loadSettings(db) {
    const link = $("#stream-link");
    const description = $("#stream-description");

    try {
      const { data, error } = await db
        .from("css_settings")
        .select("value")
        .eq("key", "stream_url")
        .maybeSingle();

      if (error) throw error;

      const streamURL = data?.value;
      if (streamURL) {
        const parsed = new URL(streamURL);

        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
          link.href = parsed.href;
          if (description) {
            description.textContent = "Open the external match stream when coverage is available.";
          }
          return;
        }
      }

      link.href = "#stream";
      link.textContent = "Stream not available";
      link.setAttribute("aria-disabled", "true");

      if (description) {
        description.textContent = "A streaming link has not been published yet.";
      }
    } catch (error) {
      console.error("CSS Skoolsport: unable to load stream settings", error);
      link.href = "#stream";
      link.textContent = "Stream unavailable";
      link.setAttribute("aria-disabled", "true");
    }
  }

  async function init() {
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();

    if (
      !url ||
      !key ||
      key === "PASTE_YOUR_PUBLISHABLE_KEY_HERE" ||
      !window.supabase
    ) {
      console.error("CSS Skoolsport: check config.js and the Supabase library.");
      showMessage("#live-matches", "Website setup is incomplete. Please check the Supabase configuration.");
      showMessage("#results", "Database connection not configured.");
      showMessage("#upcoming", "Database connection not configured.");
      showMessage("#news-list", "Database connection not configured.");
      showMessage("#gallery-list", "Database connection not configured.");
      return;
    }

    let db;

    try {
      db = window.supabase.createClient(url, key);
    } catch (error) {
      console.error("CSS Skoolsport: could not initialise Supabase", error);
      showMessage("#live-matches", "Unable to initialise the website database.");
      return;
    }

    await Promise.all([
      loadMatches(db),
      loadNews(db),
      loadGallery(db),
      loadSettings(db)
    ]);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
