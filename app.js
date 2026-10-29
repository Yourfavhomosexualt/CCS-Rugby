
/* =========================================================
   CSS SKOOLSPORT — PUBLIC WEBSITE
   Premium Match Centre | Maroon, Yellow & White
   Supabase integration preserved
   ========================================================= */

(() => {
  "use strict";

  const config = window.CSS_CONFIG || {};
  const url = config.SUPABASE_URL;
  const key = config.SUPABASE_PUBLISHABLE_KEY;

  const $ = (selector) => document.querySelector(selector);

  // Safely escape database content before displaying it.
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

    if (Number.isNaN(date.getTime())) {
      return "Date to be confirmed";
    }

    return new Intl.DateTimeFormat("en-ZA", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  };

  const card = (content) =>
    `<article class="card">${content}</article>`;

  const showMessage = (selector, message) => {
    const element = $(selector);
    if (element) {
      element.innerHTML = card(escapeHTML(message));
    }
  };

  // ---------------------------------------------------------
  // PREMIUM MATCH CARD
  // ---------------------------------------------------------

  const renderMatch = (match) => {
    const rawStatus = match.status || "Upcoming";
    const status = escapeHTML(rawStatus);

    const isLive = ["Live", "Half-time"].includes(rawStatus);
    const isCompleted = rawStatus === "Completed";
    const isPostponed = rawStatus === "Postponed";

    const homeScore = match.home_score ?? "–";
    const awayScore = match.away_score ?? "–";

    const opponent = escapeHTML(match.opponent || "Opponent TBC");
    const sport = escapeHTML(match.sport || "Sport");
    const ageGroup = escapeHTML(match.age_group || "Open");
    const venue = escapeHTML(
      match.venue || "Venue to be confirmed"
    );

    const matchDate = match.match_date
      ? formatDate(match.match_date)
      : "Date to be confirmed";

    let statusClass = "";

    if (isLive) statusClass = "live";
    else if (isCompleted) statusClass = "completed";
    else if (isPostponed) statusClass = "postponed";

    const scoreMarkup = isCompleted || isLive
      ? `
        <div class="score">${escapeHTML(homeScore)}</div>
        <span class="score-separator">–</span>
        <div class="score">${escapeHTML(awayScore)}</div>
      `
      : `
        <div class="score-placeholder">CSS</div>
        <span class="score-separator">VS</span>
        <div class="score-placeholder">${opponent}</div>
      `;

    const dateIcon = "&#128197;";
    const venueIcon = "&#128205;";

    return card(`
      <div class="match-topline">
        <span class="eyebrow">${sport}</span>
        <span class="status ${statusClass}">
          ${status}
        </span>
      </div>

      <div class="match-card-heading">
        <h3>${ageGroup}</h3>
        <span class="match-sport-label">${sport}</span>
      </div>

      <div class="broadcast-scoreboard">
        <div class="scoreboard-team">
          <div class="team-monogram">CSS</div>
          <strong>Ceres SS</strong>
        </div>

        <div class="scoreboard-result">
          ${scoreMarkup}
        </div>

        <div class="scoreboard-team opponent-team">
          <div class="team-monogram opponent-monogram">OPP</div>
          <strong>${opponent}</strong>
        </div>
      </div>

      <div class="match-card-details">
        <span>${dateIcon} ${escapeHTML(matchDate)}</span>
        <span>${venueIcon} ${venue}</span>
      </div>

      ${match.notes
        ? `<p class="match-notes">${escapeHTML(match.notes)}</p>`
        : ""}
    `);
  };

  // ---------------------------------------------------------
  // NEWS
  // ---------------------------------------------------------

  const renderNews = (item) => card(`
    <div class="news-card-content">
      <span class="eyebrow">CSS Skoolsport News</span>
      <h3>${escapeHTML(item.title || "Sports announcement")}</h3>
      <p>${escapeHTML(item.body || "")}</p>
      <p class="muted">
        ${escapeHTML(formatDate(item.published_at))}
      </p>
    </div>
  `);

  // ---------------------------------------------------------
  // GALLERY
  // ---------------------------------------------------------

  const renderGallery = (item) => card(`
    ${item.image_url ? `
      <img
        src="${escapeHTML(item.image_url)}"
        alt="${escapeHTML(
          item.title || "CSS Skoolsport sports photograph"
        )}"
        loading="lazy"
        style="
          width:100%;
          aspect-ratio:4/3;
          object-fit:cover;
          border-radius:12px;
        "
      >
    ` : ""}

    <h3>${escapeHTML(item.title || "CSS Skoolsport")}</h3>
  `);

  // ---------------------------------------------------------
  // LOAD MATCHES, RESULTS AND FIXTURES
  // ---------------------------------------------------------

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
        .order("match_date", {
          ascending: true,
          nullsFirst: false
        });

      if (error) throw error;

      const matches = data || [];

      const live = matches.filter((match) =>
        ["Live", "Half-time"].includes(match.status)
      );

      const results = matches
        .filter((match) => match.status === "Completed")
        .sort((a, b) => {
          const dateA = a.match_date
            ? new Date(a.match_date).getTime()
            : 0;
          const dateB = b.match_date
            ? new Date(b.match_date).getTime()
            : 0;

          return dateB - dateA;
        });

      const upcoming = matches.filter((match) =>
        ["Upcoming", "Postponed"].includes(match.status)
      );

      const liveContainer = $(targets.live);
      const resultsContainer = $(targets.results);
      const upcomingContainer = $(targets.upcoming);

      if (liveContainer) {
        liveContainer.innerHTML = live.length
          ? live.map(renderMatch).join("")
          : card(`
              <div class="empty-state-content">
                <span class="eyebrow">Match Centre</span>
                <h3>No live matches right now</h3>
                <p class="muted">
                  Check the fixtures and recent results below.
                </p>
              </div>
            `);
      }

      if (resultsContainer) {
        resultsContainer.innerHTML = results.length
          ? results.map(renderMatch).join("")
          : card(`
              <h3>No completed matches yet</h3>
              <p class="muted">
                Final scores will appear here after matches finish.
              </p>
            `);
      }

      if (upcomingContainer) {
        upcomingContainer.innerHTML = upcoming.length
          ? upcoming.map(renderMatch).join("")
          : card(`
              <h3>No upcoming fixtures published yet</h3>
              <p class="muted">
                New match schedules will appear here.
              </p>
            `);
      }

      const updated = $("#last-updated");

      if (updated) {
        updated.textContent = `Updated ${new Date().toLocaleTimeString(
          "en-ZA",
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        )}`;
      }
    } catch (error) {
      console.error(
        "CSS Skoolsport: unable to load fixtures",
        error
      );

      showMessage(
        targets.live,
        "Scores could not load. Please try again later."
      );

      showMessage(
        targets.results,
        "Previous results could not load."
      );

      showMessage(
        targets.upcoming,
        "Fixtures could not load."
      );
    }
  }

  // ---------------------------------------------------------
  // LOAD NEWS
  // ---------------------------------------------------------

  async function loadNews(db) {
    const container = $("#news-list");

    if (!container) return;

    try {
      const { data, error } = await db
        .from("css_news")
        .select("*")
        .order("published_at", {
          ascending: false
        });

      if (error) throw error;

      container.innerHTML = data?.length
        ? data.map(renderNews).join("")
        : card(`
            <h3>No news published yet</h3>
            <p class="muted">
              Sports announcements will appear here.
            </p>
          `);
    } catch (error) {
      console.error(
        "CSS Skoolsport: unable to load news",
        error
      );

      showMessage(
        "#news-list",
        "Sports news could not load."
      );
    }
  }

  // ---------------------------------------------------------
  // LOAD GALLERY
  // ---------------------------------------------------------

  async function loadGallery(db) {
    const container = $("#gallery-list");

    if (!container) return;

    try {
      const { data, error } = await db
        .from("css_gallery")
        .select("*")
        .order("created_at", {
          ascending: false
        });

      if (error) throw error;

      container.innerHTML = data?.length
        ? data.map(renderGallery).join("")
        : card(`
            <h3>Gallery coming soon</h3>
            <p class="muted">
              Sports photographs will appear here.
            </p>
          `);
    } catch (error) {
      console.error(
        "CSS Skoolsport: unable to load gallery",
        error
      );

      showMessage(
        "#gallery-list",
        "Gallery photographs could not load."
      );
    }
  }

  // ---------------------------------------------------------
  // LOAD LIVESTREAM SETTINGS
  // ---------------------------------------------------------

  async function loadSettings(db) {
    const link = $("#stream-link");
    const description = $("#stream-description");

    if (!link) return;

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

        if (
          parsed.protocol === "https:" ||
          parsed.protocol === "http:"
        ) {
          link.href = parsed.href;
          link.removeAttribute("aria-disabled");
          link.removeAttribute("tabindex");
          link.textContent = "Watch Live Stream";

          if (description) {
            description.textContent =
              "Open the external match stream when coverage is available.";
          }

          return;
        }
      }

      link.href = "#stream";
      link.textContent = "Stream not available";
      link.setAttribute("aria-disabled", "true");
      link.setAttribute("tabindex", "-1");

      if (description) {
        description.textContent =
          "A streaming link has not been published yet.";
      }
    } catch (error) {
      console.error(
        "CSS Skoolsport: unable to load stream settings",
        error
      );

      link.href = "#stream";
      link.textContent = "Stream unavailable";
      link.setAttribute("aria-disabled", "true");
      link.setAttribute("tabindex", "-1");

      if (description) {
        description.textContent =
          "The stream link could not be loaded.";
      }
    }
  }

  // ---------------------------------------------------------
  // INITIALISE WEBSITE
  // ---------------------------------------------------------

  async function init() {
    const year = $("#year");

    if (year) {
      year.textContent = new Date().getFullYear();
    }

    if (
      !url ||
      !key ||
      key === "PASTE_YOUR_PUBLISHABLE_KEY_HERE" ||
      !window.supabase
    ) {
      console.error(
        "CSS Skoolsport: check config.js and the Supabase library."
      );

      showMessage(
        "#live-matches",
        "Website setup is incomplete. Please check the Supabase configuration."
      );

      showMessage(
        "#results",
        "Database connection not configured."
      );

      showMessage(
        "#upcoming",
        "Database connection not configured."
      );

      showMessage(
        "#news-list",
        "Database connection not configured."
      );

      showMessage(
        "#gallery-list",
        "Database connection not configured."
      );

      return;
    }

    let db;

    try {
      db = window.supabase.createClient(url, key);
    } catch (error) {
      console.error(
        "CSS Skoolsport: could not initialise Supabase",
        error
      );

      showMessage(
        "#live-matches",
        "Unable to initialise the website database."
      );

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

