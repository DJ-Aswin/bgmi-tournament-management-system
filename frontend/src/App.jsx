import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const GAME_MODES = ["squad-tpp", "squad-fpp", "duo-tpp", "duo-fpp", "solo-tpp", "solo-fpp"];

function humanizePlayerApplicationStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "applied") return "Pending review";
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  if (s === "cancelled") return "Cancelled";
  return status || "—";
}

const LANDING_HERO_SLIDES = [
  { src: "Firefly.jpg", alt: "2026 esports roadmap" },
  { src: "slide.jpg", alt: "KRAFTON India Esports highlight" },
];

const HERO_SLIDE_INTERVAL_MS = 6500;

/** Official KRAFTON India esports site — images and live feed source. */
const KRAFTON_ESPORTS_ORIGIN = "https://kraftonindiaesports.com";

function ordinalDay(n) {
  const j = n % 10;
  const k = n % 100;
  if (k > 10 && k < 14) return `${n}th`;
  if (j === 1) return `${n}st`;
  if (j === 2) return `${n}nd`;
  if (j === 3) return `${n}rd`;
  return `${n}th`;
}

function formatApiScrimDateLine(iso) {
  if (!iso || typeof iso !== "string") return "Dates TBA";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${ordinalDay(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} onwards`;
}

function PopularScrimsRail({ cards, session, navigate }) {
  const viewportRef = useRef(null);

  const scrollRail = (direction) => {
    const el = viewportRef.current;
    if (!el) return;
    const delta = Math.min(el.clientWidth * 0.82, 280);
    el.scrollBy({ left: direction * delta, behavior: "smooth" });
  };

  const goApply = () => {
    if (session?.user?.role === "organizer") return;
    if (session?.user?.role === "player") navigate("/player");
    else navigate("/login");
  };

  return (
    <div className="scrims-krafton-rail" aria-label="Popular scrims carousel">
      <div className="scrims-krafton-viewport" ref={viewportRef}>
        <div className="scrims-krafton-track">
          {cards.map((c) => (
            <article
              key={c.key}
              className="krafton-scrim-card"
              role="button"
              tabIndex={0}
              onClick={goApply}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goApply();
                }
              }}
            >
              <div className="krafton-scrim-poster-wrap">
                {c.image ? (
                  <img
                    src={c.image}
                    alt=""
                    className="krafton-scrim-poster"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="krafton-scrim-poster krafton-scrim-poster--placeholder" aria-hidden>
                    <span>Live scrim</span>
                  </div>
                )}
              </div>
              <h3 className="krafton-scrim-title">{c.title}</h3>
              <p className="krafton-scrim-entry">{c.entryType}</p>
              <p className="krafton-scrim-dates-label">Dates</p>
              <p className="krafton-scrim-dates-value">{c.datesLine}</p>
              {c.meta ? <p className="krafton-scrim-meta">{c.meta}</p> : null}
            </article>
          ))}
        </div>
      </div>
      <div className="scrims-krafton-nav">
        <button type="button" className="scrims-krafton-arrow" aria-label="Show previous scrims" onClick={() => scrollRail(-1)}>
          ‹
        </button>
        <button type="button" className="scrims-krafton-arrow" aria-label="Show next scrims" onClick={() => scrollRail(1)}>
          ›
        </button>
      </div>
    </div>
  );
}

function SiteHeader({ session, setSession }) {
  const navigate = useNavigate();
  const logout = () => {
    setSession(null);
    navigate("/");
  };

  return (
    <header className="site-header">
      <Link to="/" className="site-brand site-brand--arenahub site-brand-link">
        <span className="site-brand-arenahub">BGMI ArenaHub</span>
        <span className="site-brand-tagline">Tournaments &amp; scrims for Indian esports</span>
      </Link>
      <nav className="site-nav">
        <NavLink to="/tournaments" className={({ isActive }) => `site-nav-link${isActive ? " site-nav-link--active" : ""}`}>
          Tournaments
        </NavLink>
        <NavLink to="/rankings" className={({ isActive }) => `site-nav-link${isActive ? " site-nav-link--active" : ""}`}>
          Rankings
        </NavLink>
        <NavLink to="/calendar" className={({ isActive }) => `site-nav-link${isActive ? " site-nav-link--active" : ""}`}>
          Calendar
        </NavLink>
      </nav>
      {session ? (
        <div className="site-auth-actions user-actions">
          <UserAccountMenu session={session} onLogout={logout} />
        </div>
      ) : (
        <div className="site-auth-actions">
          <button type="button" className="auth-btn login-btn" onClick={() => navigate("/login")}>
            Login
          </button>
          <button type="button" className="auth-btn signup-btn" onClick={() => navigate("/signup")}>
            Sign up
          </button>
        </div>
      )}
    </header>
  );
}

function PublicTournamentsPage({ session, setSession }) {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API_BASE_URL}/api/public/tournaments`)
      .then(({ data }) => {
        if (!cancelled) {
          setTournaments(data.tournaments || []);
          setLoadError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTournaments([]);
          setLoadError("Listings could not be loaded. Try again in a moment.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="explore-page explore-page--tournaments">
      <SiteHeader session={session} setSession={setSession} />
      <main className="explore-main">
        <nav className="explore-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span className="explore-breadcrumb-sep" aria-hidden>
            {" "}
            &gt;{" "}
          </span>
          <span className="explore-breadcrumb-current">Tournaments &amp; scrims</span>
        </nav>
        <header className="explore-hero">
          <h1 className="explore-hero-title">Live tournaments &amp; scrims</h1>
          <p className="explore-hero-lead">
            Events published on ArenaHub—browse open registrations. Sign in as a player to submit your squad details.
          </p>
          {!session ? (
            <div className="explore-hero-actions">
              <button type="button" className="explore-cta explore-cta--primary" onClick={() => navigate("/login")}>
                Log in to apply
              </button>
              <button type="button" className="explore-cta explore-cta--ghost" onClick={() => navigate("/signup")}>
                Create account
              </button>
            </div>
          ) : session.user?.role === "player" ? (
            <button type="button" className="explore-cta explore-cta--primary" onClick={() => navigate("/player")}>
              Go to player dashboard
            </button>
          ) : (
            <button type="button" className="explore-cta explore-cta--primary" onClick={() => navigate("/organizer")}>
              Organizer console
            </button>
          )}
        </header>

        {loadError ? <p className="explore-banner explore-banner--error">{loadError}</p> : null}

        {tournaments.length === 0 && !loadError ? (
          <section className="explore-empty-card">
            <h2 className="explore-empty-title">No tournaments or scrims right now</h2>
            <p className="explore-empty-copy">
              Stay connected—new registrations go live here as organizers post events. Check back soon or open the calendar for
              the monthly roadmap.
            </p>
            <button type="button" className="explore-cta explore-cta--ghost" onClick={() => navigate("/calendar")}>
              View calendar
            </button>
          </section>
        ) : (
          <ul className="explore-event-list">
            {tournaments.map((t) => {
              const slotsFull = t.max_teams != null && Number(t.used_slots) >= Number(t.max_teams);
              const regClosed = Number(t.registrations_open) === 0;
              return (
                <li key={t.id} className="explore-event-card">
                  <div className="explore-event-card-main">
                    <span className="explore-event-kind">{String(t.category).toLowerCase() === "scrim" ? "Scrim" : "Tournament"}</span>
                    <h2 className="explore-event-title">{t.title}</h2>
                    <p className="explore-event-meta">
                      {t.game_mode} · Starts {t.start_date} · Min ID Lv. {t.min_id_level}
                    </p>
                    <p className="explore-event-slots">
                      Slots: {t.used_slots}/{t.max_teams ?? "—"}
                      {regClosed ? <span className="explore-pill explore-pill--closed">Registrations closed</span> : null}
                      {slotsFull && !regClosed ? <span className="explore-pill explore-pill--full">Full</span> : null}
                    </p>
                    {t.map_rotation ? <p className="explore-event-maps">Maps: {t.map_rotation}</p> : null}
                    {t.organizer_whatsapp ? (
                      <p className="explore-event-wa">Organizer WhatsApp: {t.organizer_whatsapp}</p>
                    ) : null}
                  </div>
                  <div className="explore-event-card-aside">
                    <p className="explore-event-host">Host: {t.organizer_email}</p>
                    {session?.user?.role === "player" && !regClosed && !slotsFull ? (
                      <button type="button" className="explore-cta explore-cta--small" onClick={() => navigate("/player")}>
                        Apply from dashboard
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function PublicRankingsPage({ session, setSession }) {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API_BASE_URL}/api/public/rankings`)
      .then(({ data }) => {
        if (!cancelled) {
          setTeams(data.teams || []);
          setLoadError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTeams([]);
          setLoadError("Rankings could not be loaded.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="explore-page explore-page--rankings">
      <SiteHeader session={session} setSession={setSession} />
      <main className="explore-main">
        <nav className="explore-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span className="explore-breadcrumb-sep" aria-hidden>
            {" "}
            &gt;{" "}
          </span>
          <span className="explore-breadcrumb-current">Team rankings</span>
        </nav>
        <header className="explore-hero">
          <h1 className="explore-hero-title">Top teams</h1>
          <p className="explore-hero-lead">
            Ranked by approved ArenaHub registrations across live tournaments and scrims—teams that organizers have cleared for the
            lobby show up here first.
          </p>
        </header>

        {loadError ? <p className="explore-banner explore-banner--error">{loadError}</p> : null}

        {teams.length === 0 && !loadError ? (
          <section className="explore-empty-card">
            <h2 className="explore-empty-title">No ranking data yet</h2>
            <p className="explore-empty-copy">
              Once organizers approve squads for events, team names will appear on this board. Host or join an event to build the
              leaderboard.
            </p>
            <div className="explore-hero-actions">
              <button type="button" className="explore-cta explore-cta--primary" onClick={() => navigate("/tournaments")}>
                Browse events
              </button>
              {!session ? (
                <button type="button" className="explore-cta explore-cta--ghost" onClick={() => navigate("/signup")}>
                  Sign up
                </button>
              ) : null}
            </div>
          </section>
        ) : (
          <div className="explore-rankings-wrap">
            <table className="explore-rankings-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Team</th>
                  <th scope="col">Events (distinct)</th>
                  <th scope="col">Approved slots</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((row, idx) => (
                  <tr key={`${row.team_name}-${idx}`}>
                    <td className="explore-rank-num">{idx + 1}</td>
                    <td className="explore-rank-team">{row.team_name}</td>
                    <td>{row.events_played}</td>
                    <td>{row.approved_entries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="explore-rankings-footnote">
              Rankings reflect approved applications only; they are not official match placements.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

const KCAL_BAR_COLORS = ["#8ab8e8", "#e8b8c8", "#e4e4ea"];

function CalendarPage({ session, setSession }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [payload, setPayload] = useState({ events: [], byDay: {} });
  const [calError, setCalError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API_BASE_URL}/api/public/calendar`, { params: { year, month } })
      .then(({ data }) => {
        if (!cancelled) {
          setPayload({ events: data.events || [], byDay: data.byDay || {} });
          setCalError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setCalError("Calendar could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    const day = daysInPrevMonth - firstWeekday + 1 + i;
    cells.push({ segment: "adjacent", y: prevYear, m: prevMonth, day, key: `p-${prevYear}-${prevMonth}-${day}` });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ segment: "current", y: year, m: month, day: d, key: `c-${year}-${month}-${d}` });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({ segment: "adjacent", y: nextYear, m: nextMonth, day: nextDay, key: `n-${nextYear}-${nextMonth}-${nextDay}` });
    nextDay += 1;
  }

  const shiftMonth = (delta) => {
    let nm = month + delta;
    let ny = year;
    if (nm < 1) {
      nm = 12;
      ny -= 1;
    } else if (nm > 12) {
      nm = 1;
      ny += 1;
    }
    setMonth(nm);
    setYear(ny);
  };

  const goThisMonth = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const isToday = (y, m, d) => y === today.getFullYear() && m === today.getMonth() + 1 && d === today.getDate();

  const eventsForCell = (c) => {
    if (c.segment !== "current") return [];
    return payload.byDay[String(c.day)] || [];
  };

  return (
    <div className="kcal-page">
      <SiteHeader session={session} setSession={setSession} />

      <main className="kcal-main">
        <nav className="kcal-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span className="kcal-breadcrumb-sep" aria-hidden>
            {" "}
            &gt;{" "}
          </span>
          <span className="kcal-breadcrumb-current">Calendar</span>
        </nav>

        <div className="kcal-toolbar">
          <div className="kcal-toolbar-left">
            <h1 className="kcal-month-heading">
              {monthNames[month - 1].toUpperCase()} {year}
            </h1>
          </div>
          <div className="kcal-toolbar-center">
            <button type="button" className="kcal-icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              ‹
            </button>
            <button type="button" className="kcal-this-month" onClick={goThisMonth}>
              This Month
            </button>
            <button type="button" className="kcal-icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
              ›
            </button>
          </div>
          <div className="kcal-toolbar-right">
            <button type="button" className="kcal-filters-btn" disabled title="Coming soon">
              Filters ▾
            </button>
          </div>
        </div>

        {calError ? <p className="kcal-error">{calError}</p> : null}

        <div className="kcal-grid-wrap">
          <div className="kcal-grid">
            {weekdays.map((w) => (
              <div key={w} className="kcal-weekday">
                {w}
              </div>
            ))}
            {cells.map((c) => {
              const evs = eventsForCell(c);
              const visible = evs.slice(0, 3);
              const more = evs.length - visible.length;
              const todayRing = isToday(c.y, c.m, c.day);
              return (
                <div
                  key={c.key}
                  className={`kcal-cell ${c.segment === "adjacent" ? "kcal-cell--adjacent" : "kcal-cell--in-month"}`}
                >
                  <div className={`kcal-cell-daynum ${todayRing ? "kcal-cell-daynum--today" : ""}`}>{c.day}</div>
                  <div className="kcal-cell-bars">
                    {visible.map((ev, idx) => (
                      <div
                        key={ev.id}
                        className="kcal-event-bar"
                        style={{ backgroundColor: KCAL_BAR_COLORS[idx % KCAL_BAR_COLORS.length] }}
                        title={`${ev.title} (${ev.kind})`}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {more > 0 ? <div className="kcal-more">+{more} more</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

const TOURNAMENT_SLIDE_INTERVAL_MS = 5200;

function PastTournamentsSlideshow({ slides }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, TOURNAMENT_SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [slides.length]);

  const goPrev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);
  const goNext = () => setIndex((i) => (i + 1) % slides.length);

  if (!slides.length) return null;

  return (
    <div
      className="tournament-slideshow"
      aria-roledescription="carousel"
      aria-label="Past official tournaments"
      aria-live="polite"
    >
      <div className="tournament-slideshow-viewport">
        {slides.map((slide, i) => (
          <article
            key={slide.title}
            className={`tournament-slide ${i === index ? "tournament-slide--active" : ""}`}
            aria-hidden={i !== index}
            aria-label={`${slide.title}. ${slide.subtitle}. ${slide.dates}.`}
          >
            <img
              src={slide.image}
              alt=""
              aria-hidden
              className="tournament-slide-img"
              decoding={i === 0 ? "sync" : "async"}
              loading={i === 0 ? "eager" : "lazy"}
              referrerPolicy="no-referrer"
            />
            <div className="tournament-slide-overlay" aria-hidden />
            <div className="tournament-slide-caption">
              <h3>{slide.title}</h3>
              <p>{slide.subtitle}</p>
              <time className="tournament-slide-dates">{slide.dates}</time>
            </div>
          </article>
        ))}
        {slides.length > 1 ? (
          <>
            <button type="button" className="tournament-nav tournament-nav--prev" aria-label="Previous tournament" onClick={goPrev}>
              ‹
            </button>
            <button type="button" className="tournament-nav tournament-nav--next" aria-label="Next tournament" onClick={goNext}>
              ›
            </button>
            <div className="tournament-slideshow-dots" role="tablist" aria-label="Tournament slides">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`hero-dot ${i === index ? "hero-dot--active" : ""}`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
      <p className="tournament-attribution">
        Tournament visuals from{" "}
        <a href={KRAFTON_ESPORTS_ORIGIN} target="_blank" rel="noreferrer noopener">
          KRAFTON ESPORTS
        </a>
        .
      </p>
    </div>
  );
}

function HeroSlideshow({ slides }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, HERO_SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [slides.length]);

  if (!slides.length) return null;

  const base = import.meta.env.BASE_URL;

  return (
    <section
      className="hero-slideshow roadmap-panel roadmap-panel--graphic"
      aria-roledescription="carousel"
      aria-label="Featured banners"
      aria-live="polite"
    >
      <div className="hero-slideshow-viewport">
        {slides.map((slide, i) => (
          <img
            key={slide.src}
            src={`${base}${slide.src}`}
            alt={slide.alt}
            className={`hero-slide-img ${i === index ? "hero-slide-img--active" : ""}`}
            decoding={i === 0 ? "sync" : "async"}
          />
        ))}
        {slides.length > 1 ? (
          <div className="hero-slideshow-dots" role="tablist" aria-label="Slide indicators">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Go to slide ${i + 1}`}
                className={`hero-dot ${i === index ? "hero-dot--active" : ""}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const api = useMemo(() => axios.create({ baseURL: API_BASE_URL }), []);

  return (
    <Routes>
      <Route path="/" element={<HomePage session={session} setSession={setSession} />} />
      <Route path="/calendar" element={<CalendarPage session={session} setSession={setSession} />} />
      <Route path="/tournaments" element={<PublicTournamentsPage session={session} setSession={setSession} />} />
      <Route path="/rankings" element={<PublicRankingsPage session={session} setSession={setSession} />} />
      <Route path="/auth" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage api={api} session={session} setSession={setSession} />} />
      <Route path="/signup" element={<SignupPage api={api} session={session} setSession={setSession} />} />
      <Route
        path="/organizer"
        element={
          <Protected session={session} role="organizer">
            <OrganizerPage api={api} session={session} setSession={setSession} />
          </Protected>
        }
      />
      <Route
        path="/player"
        element={
          <Protected session={session} role="player">
            <PlayerPage api={api} session={session} setSession={setSession} />
          </Protected>
        }
      />
    </Routes>
  );
}

function Protected({ session, role, children }) {
  if (!session) return <Navigate to="/login" replace />;
  if (session.user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function UserAccountMenu({ session, onLogout }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const displayName = session.user.email.includes("@")
    ? session.user.email.split("@")[0]
    : session.user.email;

  return (
    <div className="user-menu" ref={wrapRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="user-menu-dropdown"
      >
        <span className="user-menu-name" title={session.user.email}>
          {displayName}
        </span>
        <span className={`user-menu-chevron ${open ? "user-menu-chevron--open" : ""}`} aria-hidden>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 4.25L6 7.75L9.5 4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open ? (
        <div id="user-menu-dropdown" className="user-menu-dropdown" role="menu">
          <button
            type="button"
            className="user-menu-signout"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <span className="user-menu-signout-icon" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M6 14H3.333A1.333 1.333 0 012 12.667V3.333A1.333 1.333 0 013.333 2H6M10.667 11.333L14 8M14 8L10.667 4.667M14 8H6"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function HomePage({ session, setSession }) {
  const navigate = useNavigate();
  const [popularScrims, setPopularScrims] = useState([]);
  const [scrimsLoadError, setScrimsLoadError] = useState(false);
  const [pastTournaments, setPastTournaments] = useState([]);
  const [kraftonEvents, setKraftonEvents] = useState([]);
  const [kraftonLoadError, setKraftonLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API_BASE_URL}/api/public/popular-scrims`)
      .then(({ data }) => {
        if (!cancelled) {
          setPopularScrims(data.scrims || []);
          setScrimsLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPopularScrims([]);
          setScrimsLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      axios.get(`${API_BASE_URL}/api/public/krafton/past-tournaments`),
      axios.get(`${API_BASE_URL}/api/public/krafton/featured-events`),
    ])
      .then(([pastRes, featuredRes]) => {
        if (cancelled) return;
        setPastTournaments(pastRes.data.tournaments || []);
        setKraftonEvents(featuredRes.data.events || []);
        setKraftonLoadError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setPastTournaments([]);
          setKraftonEvents([]);
          setKraftonLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pastTournamentSlides = useMemo(
    () =>
      pastTournaments
        .filter((t) => t.image)
        .map((t) => ({
          title: t.title,
          subtitle: t.subtitle || "",
          dates: t.dates || "",
          image: t.image,
        })),
    [pastTournaments]
  );

  const scrimRailCards = useMemo(() => {
    const apiPart = popularScrims.map((s) => ({
      key: `api-${s.id}`,
      title: s.title,
      entryType: "Open",
      datesLine: formatApiScrimDateLine(s.start_date),
      image: null,
      meta:
        s.max_teams != null
          ? `${s.used_slots}/${s.max_teams} teams · ${String(s.game_mode).replace(/-/g, " ").toUpperCase()}`
          : `${s.used_slots} teams · ${String(s.game_mode).replace(/-/g, " ").toUpperCase()}`,
    }));
    const kraftonPart = kraftonEvents
      .filter((e) => e.image)
      .map((e) => ({
        key: `krafton-${e.id}`,
        title: e.title,
        entryType: e.entryType || "Open",
        datesLine: e.datesLine,
        image: e.image,
        meta: null,
      }));
    return [...apiPart, ...kraftonPart];
  }, [popularScrims, kraftonEvents]);

  const roleActionLabel = session?.user?.role === "player" ? "Find Tournament/Scrims" : "Organize Tournament/Scrims";
  const roleActionPath = session?.user?.role === "player" ? "/player" : "/organizer";

  return (
    <div className="landing-page">
      <SiteHeader session={session} setSession={setSession} />

      <main className="home-main">
        <HeroSlideshow slides={LANDING_HERO_SLIDES} />

        {session ? (
          <section className="feature-panel feature-panel--home-cta">
            <h2>Welcome, {session.user.email}</h2>
            <p>You are logged in as {session.user.role}.</p>
            <button type="button" className="feature-panel-cta" onClick={() => navigate(roleActionPath)}>
              {roleActionLabel}
            </button>
          </section>
        ) : null}

        <section className="landing-intro" aria-labelledby="intro-heading">
          <h2 id="intro-heading">What is BGMI ArenaHub?</h2>
          <p>
            BGMI ArenaHub is your hub for <strong>Battlegrounds Mobile India</strong> competitive play: discover scrims, join
            tournaments, and run events as an organizer. We combine a clean roadmap-inspired experience with practical tools—OTP
            signup, role-based dashboards, slot checks, and application workflows built for squads and IGLs.
          </p>
          <p>
            Whether you are grinding ranked, scouting scrims, or hosting the next community cup, ArenaHub keeps registrations,
            approvals, and match details in one place. Sign up as a <strong>player</strong> to apply to listings, or as an{" "}
            <strong>organizer</strong> to publish tournaments and scrims for the community.
          </p>
        </section>

        <section className="popular-panel past-tournaments-panel">
          <h2 className="section-heading-krafton">Past tournaments</h2>
          <p className="section-lead">
            Official KRAFTON India esports seasons — slideshow synced from the{" "}
            <a className="inline-krafton-link" href={KRAFTON_ESPORTS_ORIGIN} target="_blank" rel="noreferrer noopener">
              KRAFTON ESPORTS
            </a>{" "}
            site (same banners and thumbnails as their past-tournaments feed).
          </p>
          {kraftonLoadError ? (
            <p className="scrims-empty scrims-empty--banner">Could not load live Krafton tournaments right now.</p>
          ) : null}
          {!kraftonLoadError && pastTournamentSlides.length === 0 ? (
            <p className="scrims-empty">Loading past tournaments…</p>
          ) : (
            <PastTournamentsSlideshow slides={pastTournamentSlides} />
          )}
        </section>

        <section className="popular-panel scrims-panel scrims-panel--krafton">
          <h2 className="section-heading-krafton">Popular scrims</h2>
          <p className="section-lead scrims-panel-lead">
            ArenaHub live scrims plus featured events from{" "}
            <a className="inline-krafton-link" href={KRAFTON_ESPORTS_ORIGIN} target="_blank" rel="noreferrer noopener">
              KRAFTON ESPORTS
            </a>{" "}
            — same card layout and artwork as their homepage events rail.
          </p>
          {scrimsLoadError ? (
            <p className="scrims-empty scrims-empty--banner">Could not load live ArenaHub scrims; Krafton events are still shown below.</p>
          ) : null}
          {kraftonLoadError && scrimRailCards.length === 0 ? (
            <p className="scrims-empty scrims-empty--banner">Could not load event cards right now.</p>
          ) : scrimRailCards.length === 0 ? (
            <p className="scrims-empty">Loading events…</p>
          ) : (
            <PopularScrimsRail cards={scrimRailCards} session={session} navigate={navigate} />
          )}
          <p className="scrims-footnote">
            {session?.user?.role === "organizer"
              ? "Apply to scrims with a player account. Organizers can post new scrims from the dashboard."
              : "Click a card to open the player area and apply (log in if prompted)."}
            {" "}
            <button type="button" className="link-as-button" onClick={() => navigate("/signup")}>
              Organizer signup
            </button>
          </p>
        </section>
      </main>
    </div>
  );
}

function SignupPage({ api, session, setSession }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("player");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  const resetFeedback = () => {
    setMessage("");
    setError("");
  };

  const handleSendOtp = async (event) => {
    event.preventDefault();
    resetFeedback();
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/send-otp", { email });
      setMessage(data.previewUrl ? `${data.message} Preview: ${data.previewUrl}` : data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    resetFeedback();
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/verify-otp", { email, otp });
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    resetFeedback();
    setLoading(true);
    try {
      await api.post("/api/auth/register", { email, password, role });
      const loginRes = await api.post("/api/auth/login", { email, password });
      const userSession = { token: loginRes.data.token, user: loginRes.data.user };
      setSession(userSession);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-page--login auth-page--signup">
      <header className="site-header login-page-header">
        <div className="site-brand site-brand--arenahub">
          <span className="site-brand-arenahub">BGMI ArenaHub</span>
          <span className="site-brand-tagline">Join the arena</span>
        </div>
        <nav className="auth-explore-nav" aria-label="Browse listings">
          <Link to="/tournaments" className="auth-explore-nav-link">
            Tournaments
          </Link>
          <Link to="/rankings" className="auth-explore-nav-link">
            Rankings
          </Link>
        </nav>
        <button type="button" className="back-btn" onClick={() => navigate("/")}>
          Back to Home
        </button>
        <div className="site-auth-actions">
          <button type="button" className="auth-btn login-btn" onClick={() => navigate("/login")}>
            Login
          </button>
          <button type="button" className="auth-btn signup-btn active" onClick={() => navigate("/signup")}>
            Sign up
          </button>
        </div>
      </header>

      <main className="auth-main auth-main--login">
        <div className="login-stage">
          <aside className="login-visual signup-visual" aria-hidden>
            <div className="login-visual-glow login-visual-glow--a signup-visual-glow--a" />
            <div className="login-visual-glow login-visual-glow--b signup-visual-glow--b" />
            <div className="login-visual-grid" />
            <div className="login-visual-ring signup-visual-ring" />
            <p className="login-visual-kicker">ArenaHub onboarding</p>
            <h1 className="login-visual-title">Claim your competitor profile.</h1>
            <p className="login-visual-copy">
              Verify your email with a one-time code, choose organizer or player, then lock in your password—you’ll land on the
              homepage ready to host or queue for scrims.
            </p>
            <ul className="login-visual-features">
              <li>
                <span className="login-visual-dot" /> Gmail / Ethereal OTP delivery
              </li>
              <li>
                <span className="login-visual-dot" /> Separate dashboards per role
              </li>
              <li>
                <span className="login-visual-dot" /> Encrypted password storage
              </li>
            </ul>
          </aside>

          <div className="login-form-column">
            <section className="auth-card login-card signup-wizard-card">
              <div className="login-card-accent" aria-hidden />
              <div className="login-card-head">
                <span className="login-card-eyebrow signup-card-eyebrow">New player</span>
                <h2 className="login-card-title">Create account</h2>
                <p className="login-card-lead">Three quick steps—same secure styling as sign-in.</p>
              </div>

              <div className="signup-steps-wrap">
                <div className="signup-step-block">
                  <h3 className="signup-step-heading">
                    <span className="signup-step-badge">1</span>
                    Verify email
                  </h3>
                  <p className="signup-step-hint">We’ll send a 6-digit OTP to your inbox.</p>
                  <form className="login-form" onSubmit={handleSendOtp}>
                    <div className="login-field">
                      <label htmlFor="signup-email">Email</label>
                      <input
                        id="signup-email"
                        type="email"
                        autoComplete="email"
                        className="login-input"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="login-submit signup-submit-secondary" disabled={loading}>
                      {loading ? "Sending…" : "Send OTP"}
                    </button>
                  </form>
                </div>

                <div className="signup-step-divider" aria-hidden />

                <div className="signup-step-block">
                  <h3 className="signup-step-heading">
                    <span className="signup-step-badge">2</span>
                    Enter OTP
                  </h3>
                  <p className="signup-step-hint">Paste the code from your email (valid ~10 minutes).</p>
                  <form className="login-form" onSubmit={handleVerifyOtp}>
                    <div className="login-field">
                      <label htmlFor="signup-otp">One-time password</label>
                      <input
                        id="signup-otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        className="login-input"
                        placeholder="000000"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="login-submit signup-submit-secondary" disabled={loading}>
                      {loading ? "Checking…" : "Verify OTP"}
                    </button>
                  </form>
                </div>

                <div className="signup-step-divider" aria-hidden />

                <div className="signup-step-block">
                  <h3 className="signup-step-heading">
                    <span className="signup-step-badge">3</span>
                    Role &amp; password
                  </h3>
                  <p className="signup-step-hint">Pick how you’ll use ArenaHub, then set a password (min. 6 characters).</p>
                  <form className="login-form" onSubmit={handleRegister}>
                    <div className="login-field">
                      <label htmlFor="signup-role">Role</label>
                      <select
                        id="signup-role"
                        className="login-input login-select"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                      >
                        <option value="organizer">Organizer — host tournaments &amp; scrims</option>
                        <option value="player">Player — browse &amp; apply</option>
                      </select>
                    </div>
                    <div className="login-field">
                      <label htmlFor="signup-password">Password</label>
                      <input
                        id="signup-password"
                        type="password"
                        autoComplete="new-password"
                        minLength={6}
                        className="login-input"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="login-submit" disabled={loading}>
                      {loading ? "Creating…" : "Complete signup & enter ArenaHub"}
                    </button>
                  </form>
                </div>
              </div>

              {message ? <p className="message success login-feedback">{message}</p> : null}
              {error ? <p className="message error login-feedback">{error}</p> : null}

              <p className="login-card-footer">
                Already registered?{" "}
                <button type="button" className="login-link-signup" onClick={() => navigate("/login")}>
                  Sign in
                </button>
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function LoginPage({ api, session, setSession }) {
  const navigate = useNavigate();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  const resetFeedback = () => {
    setMessage("");
    setError("");
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    resetFeedback();
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", { email: loginEmail, password: loginPassword });
      const userSession = { token: data.token, user: data.user };
      setSession(userSession);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-page--login">
      <header className="site-header login-page-header">
        <div className="site-brand site-brand--arenahub">
          <span className="site-brand-arenahub">BGMI ArenaHub</span>
          <span className="site-brand-tagline">Tournaments &amp; scrims</span>
        </div>
        <nav className="auth-explore-nav" aria-label="Browse listings">
          <Link to="/tournaments" className="auth-explore-nav-link">
            Tournaments
          </Link>
          <Link to="/rankings" className="auth-explore-nav-link">
            Rankings
          </Link>
        </nav>
        <button type="button" className="back-btn" onClick={() => navigate("/")}>
          Back to Home
        </button>
        <div className="site-auth-actions">
          <button type="button" className="auth-btn login-btn active" onClick={() => navigate("/login")}>
            Login
          </button>
          <button type="button" className="auth-btn signup-btn" onClick={() => navigate("/signup")}>
            Sign up
          </button>
        </div>
      </header>

      <main className="auth-main auth-main--login">
        <div className="login-stage">
          <aside className="login-visual" aria-hidden>
            <div className="login-visual-glow login-visual-glow--a" />
            <div className="login-visual-glow login-visual-glow--b" />
            <div className="login-visual-grid" />
            <div className="login-visual-ring" />
            <p className="login-visual-kicker">Secure access</p>
            <h1 className="login-visual-title">Welcome back, competitor.</h1>
            <p className="login-visual-copy">
              Drop into your dashboard—run scrims as an organizer or queue up for tournaments as a player.
            </p>
            <ul className="login-visual-features">
              <li>
                <span className="login-visual-dot" /> JWT-secured sessions
              </li>
              <li>
                <span className="login-visual-dot" /> OTP-verified signup flow
              </li>
              <li>
                <span className="login-visual-dot" /> Role-based ArenaHub experience
              </li>
            </ul>
          </aside>

          <div className="login-form-column">
            <section className="auth-card login-card">
              <div className="login-card-accent" aria-hidden />
              <div className="login-card-head">
                <span className="login-card-eyebrow">Account</span>
                <h2 className="login-card-title">Sign in</h2>
                <p className="login-card-lead">Enter your ArenaHub email and password to continue.</p>
              </div>

              <form className="login-form" onSubmit={handleLogin}>
                <div className="login-field">
                  <label htmlFor="login-email">Email</label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    className="login-input"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="login-field">
                  <label htmlFor="login-password">Password</label>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    className="login-input"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="login-submit" disabled={loading}>
                  {loading ? "Signing in…" : "Enter ArenaHub"}
                </button>
              </form>

              <p className="login-card-footer">
                New here?{" "}
                <button type="button" className="login-link-signup" onClick={() => navigate("/signup")}>
                  Create an account
                </button>
              </p>

              {message ? <p className="message success login-feedback">{message}</p> : null}
              {error ? <p className="message error login-feedback">{error}</p> : null}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function OrganizerPage({ api, session, setSession }) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tournaments, setTournaments] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editGameMode, setEditGameMode] = useState("squad-tpp");
  const [editForm, setEditForm] = useState(null);
  const [gameMode, setGameMode] = useState("squad-tpp");
  const [form, setForm] = useState({
    title: "",
    category: "tournament",
    startDate: "",
    matchCount: 3,
    matchTimings: "",
    mapRotation: "match 1: erangel, match 2: miramar, match 3: rondo/sanhok",
    minIdLevel: 40,
    prizePool: "",
    maxTeams: "",
    organizerWhatsapp: "",
  });

  const headers = { Authorization: `Bearer ${session.token}` };
  const resetFeedback = () => {
    setError("");
    setMessage("");
  };

  const loadTournaments = async () => {
    try {
      const { data } = await api.get("/api/organizer/tournaments", { headers });
      setTournaments(data.tournaments || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load tournaments.");
    }
  };

  const loadApplicants = async (tournamentId) => {
    try {
      const { data } = await api.get(`/api/organizer/tournaments/${tournamentId}/applicants`, { headers });
      setSelectedTournamentId(tournamentId);
      setApplicants(data.applicants || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load applicants.");
    }
  };

  const openEdit = (t) => {
    setEditingId(t.id);
    setEditGameMode(t.game_mode || "squad-tpp");
    setEditForm({
      title: t.title || "",
      category: t.category || "tournament",
      startDate: t.start_date || "",
      matchCount: t.match_count ?? 1,
      matchTimings: t.match_timings || "",
      mapRotation: t.map_rotation || "",
      minIdLevel: t.min_id_level ?? 1,
      prizePool: t.prize_pool ?? "",
      maxTeams: t.max_teams ?? "",
      organizerWhatsapp: t.organizer_whatsapp ?? "",
    });
    resetFeedback();
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editingId || !editForm) return;
    resetFeedback();
    try {
      const tid = editingId;
      const { data } = await api.patch(
        `/api/organizer/tournaments/${editingId}`,
        {
          title: editForm.title,
          category: editForm.category,
          gameMode: editGameMode,
          startDate: editForm.startDate,
          matchCount: Number(editForm.matchCount),
          matchTimings: editForm.matchTimings,
          mapRotation: editForm.mapRotation,
          minIdLevel: Number(editForm.minIdLevel),
          prizePool: editForm.prizePool,
          maxTeams: editForm.maxTeams === "" ? null : Number(editForm.maxTeams),
          organizerWhatsapp: String(editForm.organizerWhatsapp ?? "").trim(),
        },
        { headers }
      );
      setMessage(data.message);
      setEditingId(null);
      setEditForm(null);
      await loadTournaments();
      if (selectedTournamentId === tid) await loadApplicants(tid);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save changes.");
    }
  };

  const toggleRegistrations = async (t) => {
    resetFeedback();
    const isOpen = t.registrations_open === undefined || Number(t.registrations_open) !== 0;
    try {
      const { data } = await api.patch(
        `/api/organizer/tournaments/${t.id}`,
        { registrationsOpen: !isOpen },
        { headers }
      );
      setMessage(data.message);
      await loadTournaments();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update registrations.");
    }
  };

  const cancelEvent = async (t) => {
    const tid = Number(t.id);
    if (String(t.status || "active").toLowerCase() === "cancelled") return;
    if (!window.confirm(`Cancel “${t.title}”? Players will no longer see or join this event.`)) return;
    resetFeedback();
    try {
      const { data } = await api.patch(`/api/organizer/tournaments/${tid}`, { status: "cancelled" }, { headers });
      setMessage(data.message || "Event cancelled.");
      if (Number(selectedTournamentId) === tid) {
        setSelectedTournamentId(null);
        setApplicants([]);
      }
      if (Number(editingId) === tid) {
        setEditingId(null);
        setEditForm(null);
      }
      await loadTournaments();
    } catch (err) {
      setError(err.response?.data?.message || "Could not cancel event.");
    }
  };

  const createTournament = async (event) => {
    event.preventDefault();
    resetFeedback();
    try {
      const payload = { ...form, gameMode };
      const { data } = await api.post("/api/organizer/tournaments", payload, { headers });
      setMessage(data.message);
      await loadTournaments();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create tournament.");
    }
  };

  const updateStatus = async (applicationId, status) => {
    resetFeedback();
    try {
      const { data } = await api.patch(`/api/organizer/applications/${applicationId}`, { status }, { headers });
      setMessage(data.message);
      if (selectedTournamentId) await loadApplicants(selectedTournamentId);
      await loadTournaments();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status.");
    }
  };

  const logout = () => {
    setSession(null);
    navigate("/");
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTournaments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedEventMeta = useMemo(() => {
    const t = tournaments.find((x) => Number(x.id) === Number(selectedTournamentId));
    if (!t) return { title: null, cancelled: false };
    return {
      title: t.title ?? null,
      cancelled: String(t.status || "active").toLowerCase() === "cancelled",
    };
  }, [tournaments, selectedTournamentId]);

  const applicantsByStatus = useMemo(() => {
    const pending = [];
    const approved = [];
    const rejected = [];
    const cancelled = [];
    const other = [];
    for (const a of applicants) {
      if (a.status === "applied") pending.push(a);
      else if (a.status === "approved") approved.push(a);
      else if (a.status === "rejected") rejected.push(a);
      else if (a.status === "cancelled") cancelled.push(a);
      else other.push(a);
    }
    return { pending, approved, rejected, cancelled, other };
  }, [applicants]);

  const renderApplicantRow = (a, { actionsEnabled }) => (
    <div key={a.id} className={`list-item applicant-row applicant-row--${a.status}`}>
      <div>
        <strong>{a.team_name}</strong> — {a.player_email}
        <p className="applicant-meta">
          IGL: {a.igl_contact} | UID: {a.player_uid} | IGN: {a.player_ign} | Level: {a.player_id_level}
        </p>
      </div>
      {actionsEnabled ? (
        <div className="actions applicant-actions">
          <button type="button" className="applicant-btn-approve" onClick={() => updateStatus(a.id, "approved")}>
            Approve
          </button>
          <button type="button" className="applicant-btn-reject" onClick={() => updateStatus(a.id, "rejected")}>
            Reject
          </button>
        </div>
      ) : a.status === "applied" ? (
        <span className="applicant-status-badge applicant-status-badge--pending-frozen">Pending — event cancelled</span>
      ) : (
        <span className={`applicant-status-badge applicant-status-badge--${a.status}`}>
          {a.status === "approved"
            ? "Approved"
            : a.status === "rejected"
              ? "Rejected"
              : a.status === "cancelled"
                ? "Cancelled"
                : a.status}
        </span>
      )}
    </div>
  );

  return (
    <div className={`page organizer-page${selectedTournamentId ? " organizer-page--reviewing" : ""}`}>
      <header className="topbar topbar--dashboard topbar--organizer">
        <div className="topbar-brand">
          <span className="topbar-brand-name">BGMI ArenaHub</span>
          <span className="topbar-brand-role">Organizer console</span>
        </div>
        <div className="actions">
          <button type="button" className="dashboard-back-btn" onClick={() => navigate("/")}>
            Back
          </button>
          <button type="button" onClick={loadTournaments}>
            Refresh
          </button>
          <button type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
      <main className="dashboard">
        <section className="auth-card">
          <h2>Organizer Dashboard</h2>
          <form onSubmit={createTournament}>
            <label>Tournament/Scrim Name</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="tournament">Tournament</option>
              <option value="scrim">Scrim</option>
            </select>
            <label>Game Mode</label>
            <div className="mode-buttons">
              {GAME_MODES.map((mode) => (
                <button key={mode} type="button" className={gameMode === mode ? "chip active-chip" : "chip"} onClick={() => setGameMode(mode)}>
                  {mode}
                </button>
              ))}
            </div>
            <label>Total Number of Matches</label>
            <input type="number" min={1} value={form.matchCount} onChange={(e) => setForm({ ...form, matchCount: e.target.value })} required />
            <label>Match Timings</label>
            <input value={form.matchTimings} onChange={(e) => setForm({ ...form, matchTimings: e.target.value })} placeholder="6:30 PM, 7:15 PM, 8:00 PM" required />
            <label>Map Rotation</label>
            <input value={form.mapRotation} onChange={(e) => setForm({ ...form, mapRotation: e.target.value })} required />
            <label>Minimum ID Level</label>
            <input type="number" min={1} value={form.minIdLevel} onChange={(e) => setForm({ ...form, minIdLevel: e.target.value })} required />
            <label>Prize Pool (Optional)</label>
            <input value={form.prizePool} onChange={(e) => setForm({ ...form, prizePool: e.target.value })} />
            <label>Max Team Registrations</label>
            <input type="number" min={1} value={form.maxTeams} onChange={(e) => setForm({ ...form, maxTeams: e.target.value })} required />
            <label>Your WhatsApp (for approved teams)</label>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={form.organizerWhatsapp}
              onChange={(e) => setForm({ ...form, organizerWhatsapp: e.target.value })}
              required
            />
            <label>Start Date</label>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            <button type="submit">Create Event</button>
          </form>
        </section>

        {editingId && editForm ? (
          <section className="auth-card organizer-edit-card">
            <h3>Edit event #{editingId}</h3>
            <form onSubmit={saveEdit}>
              <label>Tournament/Scrim Name</label>
              <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
              <label>Category</label>
              <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                <option value="tournament">Tournament</option>
                <option value="scrim">Scrim</option>
              </select>
              <label>Game Mode</label>
              <div className="mode-buttons">
                {GAME_MODES.map((mode) => (
                  <button key={mode} type="button" className={editGameMode === mode ? "chip active-chip" : "chip"} onClick={() => setEditGameMode(mode)}>
                    {mode}
                  </button>
                ))}
              </div>
              <label>Total Number of Matches</label>
              <input type="number" min={1} value={editForm.matchCount} onChange={(e) => setEditForm({ ...editForm, matchCount: e.target.value })} required />
              <label>Match Timings</label>
              <input value={editForm.matchTimings} onChange={(e) => setEditForm({ ...editForm, matchTimings: e.target.value })} required />
              <label>Map Rotation</label>
              <input value={editForm.mapRotation} onChange={(e) => setEditForm({ ...editForm, mapRotation: e.target.value })} required />
              <label>Minimum ID Level</label>
              <input type="number" min={1} value={editForm.minIdLevel} onChange={(e) => setEditForm({ ...editForm, minIdLevel: e.target.value })} required />
              <label>Prize Pool (Optional)</label>
              <input value={editForm.prizePool} onChange={(e) => setEditForm({ ...editForm, prizePool: e.target.value })} />
              <label>Max Team Registrations</label>
              <input type="number" min={1} value={editForm.maxTeams} onChange={(e) => setEditForm({ ...editForm, maxTeams: e.target.value })} required />
              <label>Your WhatsApp (for approved teams)</label>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                value={editForm.organizerWhatsapp}
                onChange={(e) => setEditForm({ ...editForm, organizerWhatsapp: e.target.value })}
                required
              />
              <label>Start Date</label>
              <input type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} required />
              <div className="organizer-edit-actions">
                <button type="button" className="organizer-btn-secondary" onClick={() => { setEditingId(null); setEditForm(null); }}>
                  Discard
                </button>
                <button type="submit">Save changes</button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="auth-card">
          <h3>Your Tournaments/Scrims</h3>
          <div className="list">
            {tournaments.map((t) => {
              const isCancelled = String(t.status || "active").toLowerCase() === "cancelled";
              return (
              <div key={t.id} className={`list-item organizer-event-row${isCancelled ? " organizer-event-row--cancelled" : ""}`}>
                <div>
                  <strong>{t.title}</strong> ({t.category}) — {t.game_mode}
                  <p>
                    Slots: {t.used_slots}/{t.max_teams} | Min ID Lv. {t.min_id_level} | Starts {t.start_date}
                  </p>
                  {t.organizer_whatsapp ? (
                    <p className="organizer-event-whatsapp">Your WhatsApp on listing: {t.organizer_whatsapp}</p>
                  ) : null}
                  <p className="organizer-event-badges">
                    {isCancelled ? (
                      <span className="badge badge--cancelled">Event cancelled</span>
                    ) : Number(t.registrations_open) === 0 ? (
                      <span className="badge badge--closed">Registrations closed</span>
                    ) : (
                      <span className="badge badge--open">Accepting applications</span>
                    )}
                  </p>
                </div>
                <div className="organizer-event-actions">
                  {isCancelled ? (
                    <button type="button" onClick={() => loadApplicants(Number(t.id))}>
                      View applicants
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => openEdit(t)}>
                        Edit
                      </button>
                      <button type="button" onClick={() => toggleRegistrations(t)}>
                        {Number(t.registrations_open) !== 0 ? "Close registrations" : "Open registrations"}
                      </button>
                      <button type="button" className="organizer-btn-danger" onClick={() => cancelEvent(t)}>
                        Cancel event
                      </button>
                      <button type="button" onClick={() => loadApplicants(Number(t.id))}>
                        View applicants
                      </button>
                    </>
                  )}
                </div>
              </div>
            );})}
          </div>
        </section>

        {selectedTournamentId ? (
          <section className="auth-card applicants-panel">
            <div className="applicants-panel-head">
              <h3>
                Applicants
                {selectedEventMeta.title ? ` — ${selectedEventMeta.title}` : ` — Event #${selectedTournamentId}`}
              </h3>
              <button
                type="button"
                className="applicants-close-btn"
                onClick={() => {
                  setSelectedTournamentId(null);
                  setApplicants([]);
                }}
              >
                Close list
              </button>
            </div>
            {selectedEventMeta.cancelled ? (
              <p className="applicants-cancelled-banner">This event is cancelled. It is hidden from players. Application actions are disabled.</p>
            ) : null}
            {applicants.length === 0 ? (
              <p className="applicants-empty">No applications yet for this event.</p>
            ) : (
              <div className="applicants-sections">
                <div className="applicants-section">
                  <h4 className="applicants-section-title">Pending review</h4>
                  {applicantsByStatus.pending.length === 0 ? (
                    <p className="applicants-section-empty">No pending applications.</p>
                  ) : (
                    <div className="list">{applicantsByStatus.pending.map((a) => renderApplicantRow(a, { actionsEnabled: !selectedEventMeta.cancelled }))}</div>
                  )}
                </div>
                <div className="applicants-section">
                  <h4 className="applicants-section-title">Approved</h4>
                  {applicantsByStatus.approved.length === 0 ? (
                    <p className="applicants-section-empty">None yet.</p>
                  ) : (
                    <div className="list">{applicantsByStatus.approved.map((a) => renderApplicantRow(a, { actionsEnabled: false }))}</div>
                  )}
                </div>
                <div className="applicants-section">
                  <h4 className="applicants-section-title">Rejected</h4>
                  {applicantsByStatus.rejected.length === 0 ? (
                    <p className="applicants-section-empty">None yet.</p>
                  ) : (
                    <div className="list">{applicantsByStatus.rejected.map((a) => renderApplicantRow(a, { actionsEnabled: false }))}</div>
                  )}
                </div>
                <div className="applicants-section">
                  <h4 className="applicants-section-title">Cancelled (event)</h4>
                  {applicantsByStatus.cancelled.length === 0 ? (
                    <p className="applicants-section-empty">None.</p>
                  ) : (
                    <div className="list">{applicantsByStatus.cancelled.map((a) => renderApplicantRow(a, { actionsEnabled: false }))}</div>
                  )}
                </div>
                {applicantsByStatus.other.length > 0 ? (
                  <div className="applicants-section">
                    <h4 className="applicants-section-title">Other</h4>
                    <div className="list">{applicantsByStatus.other.map((a) => renderApplicantRow(a, { actionsEnabled: false }))}</div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        ) : null}
        {message ? <p className="message success">{message}</p> : null}
        {error ? <p className="message error">{error}</p> : null}
      </main>
    </div>
  );
}

function PlayerPage({ api, session, setSession }) {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ teamName: "", iglContact: "", playerUid: "", playerIgn: "", playerIdLevel: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [detailTournamentId, setDetailTournamentId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailData, setDetailData] = useState(null);
  const headers = { Authorization: `Bearer ${session.token}` };

  const load = async () => {
    try {
      const tRes = await api.get("/api/tournaments", { headers });
      setTournaments(tRes.data.tournaments || []);
      const aRes = await api.get("/api/player/applications", { headers });
      setApplications(aRes.data.applications || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dashboard.");
    }
  };

  const apply = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const { data } = await api.post(`/api/player/apply/${selectedId}`, form, { headers });
      setMessage(data.message);
      setSelectedId(null);
      setForm({ teamName: "", iglContact: "", playerUid: "", playerIgn: "", playerIdLevel: "" });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Apply failed.");
    }
  };

  const logout = () => {
    setSession(null);
    navigate("/");
  };

  const closeDetails = () => {
    setDetailTournamentId(null);
    setDetailData(null);
    setDetailError("");
    setDetailLoading(false);
  };

  const openDetails = async (tournamentId) => {
    const tid = Number(tournamentId);
    setDetailTournamentId(tid);
    setDetailLoading(true);
    setDetailError("");
    setDetailData(null);
    try {
      const { data } = await api.get(`/api/player/tournaments/${tid}/details`, { headers });
      setDetailData(data);
    } catch (err) {
      setDetailError(err.response?.data?.message || "Could not load details.");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page player-page">
      <header className="topbar topbar--dashboard topbar--player">
        <div className="topbar-brand">
          <span className="topbar-brand-name">BGMI ArenaHub</span>
          <span className="topbar-brand-role">Player lobby</span>
        </div>
        <div className="actions">
          <button type="button" className="dashboard-back-btn" onClick={() => navigate("/")}>
            Back
          </button>
          <button type="button" onClick={load}>
            Refresh
          </button>
          <button type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
      <main className="dashboard">
        <section className="auth-card">
          <h2>Player Dashboard</h2>
          {tournaments.length === 0 ? (
            <div className="player-empty-listings">
              <p className="player-empty-listings-title">No tournaments or scrims available right now.</p>
              <p className="player-empty-listings-copy">
                Stay connected and tuned in—new registrations will show up here as soon as organizers publish events. You can also
                browse the public listings or calendar from the home page.
              </p>
              <div className="player-empty-listings-actions">
                <button type="button" className="player-empty-link-btn" onClick={() => navigate("/tournaments")}>
                  View all listings
                </button>
                <button type="button" className="player-empty-link-btn player-empty-link-btn--ghost" onClick={() => navigate("/calendar")}>
                  Open calendar
                </button>
              </div>
            </div>
          ) : (
            <div className="list">
              {tournaments.map((t) => {
                const slotsFull = t.max_teams != null && t.used_slots >= t.max_teams;
                const regClosed = Number(t.registrations_open) === 0;
                return (
                  <div key={t.id} className="list-item">
                    <div>
                      <strong>{t.title}</strong> ({t.category}) - {t.game_mode}
                      <p>Slots: {t.used_slots}/{t.max_teams} | Min ID Level: {t.min_id_level}</p>
                      <p>Maps: {t.map_rotation}</p>
                      {t.organizer_whatsapp ? (
                        <p className="player-organizer-whatsapp">Organizer WhatsApp: {t.organizer_whatsapp}</p>
                      ) : null}
                      {regClosed ? <p className="player-reg-hint">Registrations closed by organizer.</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      disabled={slotsFull || regClosed}
                    >
                      {slotsFull ? "No slots available" : regClosed ? "Closed" : "Apply"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {selectedId ? (
          <section className="auth-card">
            <h3>Apply for Tournament #{selectedId}</h3>
            <form onSubmit={apply}>
              <label>Team Name</label>
              <input value={form.teamName} onChange={(e) => setForm({ ...form, teamName: e.target.value })} required />
              <label>IGL Contact Number</label>
              <input value={form.iglContact} onChange={(e) => setForm({ ...form, iglContact: e.target.value })} required />
              <label>Player UID</label>
              <input value={form.playerUid} onChange={(e) => setForm({ ...form, playerUid: e.target.value })} required />
              <label>Player IGN</label>
              <input value={form.playerIgn} onChange={(e) => setForm({ ...form, playerIgn: e.target.value })} required />
              <label>ID Level</label>
              <input type="number" min={1} value={form.playerIdLevel} onChange={(e) => setForm({ ...form, playerIdLevel: e.target.value })} required />
              <button type="submit">Submit Application</button>
            </form>
          </section>
        ) : null}

        <section className="auth-card">
          <h3>My Applications</h3>
          {applications.length === 0 ? (
            <p className="player-applications-empty">You have not applied to any event yet.</p>
          ) : (
            <div className="list">
              {applications.map((a) => {
                const eventCancelled = String(a.tournament_status || "active").toLowerCase() === "cancelled";
                const appCancelled = String(a.status || "").toLowerCase() === "cancelled";
                const showAsCancelled = eventCancelled || appCancelled;
                return (
                  <div
                    key={a.id}
                    className={`list-item player-application-row${showAsCancelled ? " player-application-row--event-cancelled" : ""}`}
                  >
                    <div className="player-application-row-main">
                      <strong>{a.title}</strong>
                      <p className="player-application-status-line">
                        <strong>Status:</strong>{" "}
                        <span
                          className={
                            showAsCancelled ? "player-status-text-cancelled" : `player-status-text player-status-text--${a.status}`
                          }
                        >
                          {showAsCancelled ? "Cancelled" : humanizePlayerApplicationStatus(a.status)}
                        </span>
                      </p>
                      {showAsCancelled ? (
                        <p className="player-application-cancelled-explainer">
                          The organizer cancelled this event. Your application is closed with this listing.
                        </p>
                      ) : null}
                      <p className="player-application-meta">
                        {a.category} · Starts {a.start_date}
                      </p>
                    </div>
                    <button type="button" className="player-app-details-btn" onClick={() => openDetails(a.tournament_id)}>
                      Details
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {detailTournamentId != null ? (
          <div className="player-modal-backdrop" role="presentation" onClick={closeDetails}>
            <div
              className="player-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="player-detail-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="player-modal-head">
                <h3 id="player-detail-title">Event details</h3>
                <button type="button" className="player-modal-close" onClick={closeDetails} aria-label="Close">
                  ×
                </button>
              </div>
              <div className="player-modal-body">
                {detailLoading ? <p className="player-modal-loading">Loading…</p> : null}
                {detailError ? <p className="message error player-modal-error">{detailError}</p> : null}
                {detailData?.tournament && detailData?.application ? (
                  <>
                    <section className="player-detail-section">
                      <h4>What the organizer published</h4>
                      <dl className="player-detail-dl">
                        <div>
                          <dt>Name</dt>
                          <dd>{detailData.tournament.title}</dd>
                        </div>
                        <div>
                          <dt>Type</dt>
                          <dd>{detailData.tournament.category}</dd>
                        </div>
                        <div>
                          <dt>Game mode</dt>
                          <dd>{detailData.tournament.game_mode}</dd>
                        </div>
                        <div>
                          <dt>Start date</dt>
                          <dd>{detailData.tournament.start_date}</dd>
                        </div>
                        <div>
                          <dt>Matches</dt>
                          <dd>{detailData.tournament.match_count}</dd>
                        </div>
                        <div>
                          <dt>Match timings</dt>
                          <dd>{detailData.tournament.match_timings}</dd>
                        </div>
                        <div>
                          <dt>Map rotation</dt>
                          <dd>{detailData.tournament.map_rotation}</dd>
                        </div>
                        <div>
                          <dt>Minimum ID level</dt>
                          <dd>{detailData.tournament.min_id_level}</dd>
                        </div>
                        <div>
                          <dt>Prize pool</dt>
                          <dd>{detailData.tournament.prize_pool || "—"}</dd>
                        </div>
                        <div>
                          <dt>Max teams</dt>
                          <dd>{detailData.tournament.max_teams ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>Slots in use</dt>
                          <dd>
                            {detailData.tournament.used_slots}/{detailData.tournament.max_teams ?? "—"}
                          </dd>
                        </div>
                        <div>
                          <dt>Registrations</dt>
                          <dd>{Number(detailData.tournament.registrations_open) === 0 ? "Closed" : "Open"}</dd>
                        </div>
                        <div>
                          <dt>Event status</dt>
                          <dd>{String(detailData.tournament.status || "active").toLowerCase() === "cancelled" ? "Cancelled" : "Active"}</dd>
                        </div>
                        <div>
                          <dt>Organizer email</dt>
                          <dd>{detailData.tournament.organizer_email}</dd>
                        </div>
                        <div>
                          <dt>Organizer WhatsApp</dt>
                          <dd>{detailData.tournament.organizer_whatsapp || "—"}</dd>
                        </div>
                      </dl>
                    </section>
                    <section className="player-detail-section">
                      <h4>Your registration</h4>
                      <dl className="player-detail-dl">
                        <div>
                          <dt>Application status</dt>
                          <dd>{humanizePlayerApplicationStatus(detailData.application.status)}</dd>
                        </div>
                        <div>
                          <dt>Submitted</dt>
                          <dd>{detailData.application.created_at}</dd>
                        </div>
                        <div>
                          <dt>Team name</dt>
                          <dd>{detailData.application.team_name}</dd>
                        </div>
                        <div>
                          <dt>IGL contact</dt>
                          <dd>{detailData.application.igl_contact}</dd>
                        </div>
                        <div>
                          <dt>Player UID</dt>
                          <dd>{detailData.application.player_uid}</dd>
                        </div>
                        <div>
                          <dt>Player IGN</dt>
                          <dd>{detailData.application.player_ign}</dd>
                        </div>
                        <div>
                          <dt>ID level</dt>
                          <dd>{detailData.application.player_id_level}</dd>
                        </div>
                      </dl>
                    </section>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {message ? <p className="message success">{message}</p> : null}
        {error ? <p className="message error">{error}</p> : null}
      </main>
    </div>
  );
}

export default App;
