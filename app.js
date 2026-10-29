(() => {
  const $ = (selector) => document.querySelector(selector);

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function dateLabel(value) {
    if (!value) return "Date not recorded";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date to be confirmed";
    return date.toLocaleString("en-ZA", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function statusClass(status) {
    if (status === "Live" || status === "Half-time") return "live";
    if (status === "Completed") return "completed";
    return "";
  }

  function matchCard(match) {
    const hasScore = match.home_score !== null && match.away_score !== null;
    const score = hasScore
      ? `<div class="score"><span>${match.home_score}</span><span>–</span><span>${match.away_score}</span></div>`
      : `<p class="muted">Score not available</p>`;

    return `
      <article class="card match-card">
        <div class="match-top">
          <span class="match-sport">${escapeHTML(match.sport)} · ${escapeHTML(match.age_group)}</span>
          <span class="status ${statusClass(match.status)}">${escapeHTML(match.status)}</span>
        </div>
        <h3>CSS vs ${escapeHTML(match.opponent)}</h3>
        ${score}
        <p class="muted small">${escapeHTML(dateLabel(match.match_date))}</p>
        <p class="muted small">${escapeHTML(match.venue || "Venue to be confirmed")}</p>
        ${match.notes ? `<p class="small">${escapeHTML(match.notes)}</p>` : ""}
      </article>`;
  }

  async function getRows(table, options = {}) {
    const { data, error } = await window.cssDB
      .from(table)
      .select("*")
      .order(options.order || "created_at", {
        ascending: options.ascending ?? false,
        nullsFirst: false
      })
      .limit(options.limit || 50);

    if (error) throw error;
    return data || [];
  }

  function showLoadError(selector, label) {
    const target = $(selector);
    if (target) {
      target.innerHTML = `<article class="card">${escapeHTML(label)} could not be loaded. Please try again later.</article>`;
    }
  }

  async function loadMatches() {
    const matches = await getRows("css_fixtures", {
      order: "match_date",
      ascending: true
    });

    const now = Date.now();
    const live = matches.filter((m) =>
      m.status === "Live" || m.status === "Half-time"
    );
    const completed = matches.filter((m) => m.status === "Completed");
    const upcoming = matches.filter((m) =>
      m.status === "Upcoming" &&
      (!m.match_date || new Date(m.match_date).getTime() >= now)
    );

    $("#live-matches").innerHTML = live.length
      ? live.map(matchCard).join("")
      : `<article class="card"><h3>No live matches right now</h3><p class="muted">Check the fixtures or previous results below.</p></article>`;

    $("#results").innerHTML = completed.length
      ? completed.map(matchCard).join("")
      : `<article class="card">No completed results have been published yet.</article>`;

    $("#upcoming").innerHTML = upcoming.length
      ? upcoming.map(matchCard).join("")
      : `<article class="card">No upcoming fixtures have been published yet.</article>`;

    $("#last-updated").textContent =
      "Updated " + new Date().toLocaleTimeString("en-ZA", {
        hour: "2-digit", minute: "2-digit"
      });
  }

  async function loadNews() {
    const news = await getRows("css_news", {
      order: "published_at",
      ascending: false,
      limit: 12
    });

    $("#news-list").innerHTML = news.length
      ? news.map((item) => `
        <article class="card news-card">
          <p class="news-date">${escapeHTML(dateLabel(item.published_at))}</p>
          <h3>${escapeHTML(item.title)}</h3>
          <p>${escapeHTML(item.body)}</p>
        </article>`).join("")
      : `<article class="card">No news or announcements have been published yet.</article>`;
  }

  async function loadGallery() {
    const images = await getRows("css_gallery", {
      order: "created_at",
      ascending: false,
      limit: 30
    });

    $("#gallery-list").innerHTML = images.length
      ? images.map((item) => `
        <article class="card gallery-card">
          <a href="${escapeHTML(item.image_url)}" target="_blank" rel="noopener noreferrer">
            <img class="gallery-image"
              src="${escapeHTML(item.image_url)}"
              alt="${escapeHTML(item.title || "CSS Skoolsport gallery image")}"
              loading="lazy">
          </a>
          <h3>${escapeHTML(item.title || "Match-day moment")}</h3>
        </article>`).join("")
      : `<article class="card">Photos will appear here when they are uploaded.</article>`;
  }

  async function loadStream() {
    const { data, error } = await window.cssDB
      .from("css_settings")
      .select("value")
      .eq("key", "stream_url")
      .maybeSingle();

    const link = $("#stream-link");
    if (error || !data?.value) {
      link.classList.add("hidden");
      $("#stream-description").textContent =
        "No stream link has been published yet.";
      return;
    }

    try {
      const url = new URL(data.value);
      if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid URL");
      link.href = url.href;
      link.classList.remove("hidden");
      $("#stream-description").textContent =
        "Open the published stream link. Availability depends on the stream provider.";
    } catch {
      link.classList.add("hidden");
      $("#stream-description").textContent =
        "The stream link is not configured correctly.";
    }
  }

  async function init() {
    $("#year").textContent = new Date().getFullYear();

    if (
      !window.supabase ||
      !window.CSS_SUPABASE_URL ||
      !window.CSS_SUPABASE_ANON_KEY ||
      window.CSS_SUPABASE_URL.includes("YOUR_") ||
      window.CSS_SUPABASE_ANON_KEY.includes("YOUR_")
    ) {
      $("#live-matches").innerHTML =
        `<article class="card">Website setup is not complete. Supabase configuration is required.</article>`;
      return;
    }

    window.cssDB = window.supabase.createClient(
      window.CSS_SUPABASE_URL,
      window.CSS_SUPABASE_ANON_KEY
    );

    const tasks = [
      ["#live-matches", loadMatches],
      ["#news-list", loadNews],
      ["#gallery-list", loadGallery],
      ["#stream-link", loadStream]
    ];

    for (const [selector, task] of tasks) {
      try {
        await task();
      } catch (error) {
        console.error("CSS Skoolsport loading error:", error);
        showLoadError(selector, "Website content");
      }
    }

    // Refresh displayed scores periodically. This does not generate scores;
    // an administrator must update them in the dashboard.
    window.setInterval(async () => {
      try {
        await loadMatches();
      } catch (error) {
        console.error("Score refresh failed:", error);
      }
    }, 60000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();