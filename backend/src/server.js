require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");
const { sendOtpEmail } = require("./mailer");
const { getPastTournaments, getFeaturedEvents } = require("./kraftonFeed");

const app = express();
const PORT = process.env.PORT || 5000;
const OTP_TTL_MS = 10 * 60 * 1000;

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

const dbGet = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const dbRun = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.run(query, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

const dbAll = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication required." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-key");
    req.user = payload;
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ message: `Only ${role}s can access this resource.` });
    }
    return next();
  };
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/public/krafton/past-tournaments", async (_req, res) => {
  try {
    const tournaments = await getPastTournaments();
    res.json({ tournaments, source: "kraftonindiaesports.com" });
  } catch (error) {
    res.status(500).json({ message: "Could not load Krafton past tournaments.", error: error.message });
  }
});

app.get("/api/public/krafton/featured-events", async (_req, res) => {
  try {
    const events = await getFeaturedEvents();
    res.json({ events, source: "kraftonindiaesports.com" });
  } catch (error) {
    res.status(500).json({ message: "Could not load Krafton featured events.", error: error.message });
  }
});

app.get("/api/public/popular-scrims", async (_req, res) => {
  try {
    const scrims = await dbAll(
      `SELECT t.id, t.title, t.game_mode, t.start_date, t.max_teams, t.min_id_level,
      (SELECT COUNT(*) FROM tournament_applications a WHERE a.tournament_id = t.id AND a.status IN ('applied','approved')) AS used_slots
       FROM tournaments t
       WHERE LOWER(t.category) = 'scrim'
       AND COALESCE(t.status, 'active') != 'cancelled'
       ORDER BY used_slots DESC, t.created_at DESC
       LIMIT 8`
    );
    res.json({ scrims });
  } catch (error) {
    res.status(500).json({ message: "Could not fetch scrims.", error: error.message });
  }
});

/** Month calendar for landing page — highlights events; “popular” = top interest (used_slots) in that month */
app.get("/api/public/calendar", async (req, res) => {
  try {
    const y = Number(req.query.year) || new Date().getFullYear();
    const m = Number(req.query.month);
    const month = m >= 1 && m <= 12 ? m : new Date().getMonth() + 1;
    const ym = `${y}-${String(month).padStart(2, "0")}`;

    const rows = await dbAll(
      `SELECT t.id, t.title, t.category, t.start_date, t.game_mode,
       (SELECT COUNT(*) FROM tournament_applications a WHERE a.tournament_id = t.id AND a.status IN ('applied','approved')) AS used_slots
       FROM tournaments t
       WHERE strftime('%Y-%m', t.start_date) = ?
       AND COALESCE(t.status, 'active') != 'cancelled'
       ORDER BY used_slots DESC, t.title ASC`,
      [ym]
    );

    const withSlots = rows.map((r) => ({
      ...r,
      used_slots: Number(r.used_slots) || 0,
      day: Number(String(r.start_date).slice(8, 10)) || 1,
    }));

    const maxSlots = withSlots.length ? Math.max(...withSlots.map((x) => x.used_slots)) : 0;
    const popularThreshold =
      maxSlots > 0 ? Math.max(1, Math.ceil(maxSlots * 0.6)) : 0;

    const events = withSlots.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      game_mode: r.game_mode,
      start_date: r.start_date,
      day: r.day,
      used_slots: r.used_slots,
      popular: r.used_slots >= popularThreshold && r.used_slots > 0,
      kind: String(r.category).toLowerCase() === "scrim" ? "scrim" : "tournament",
    }));

    const byDay = {};
    for (const ev of events) {
      const k = String(ev.day);
      if (!byDay[k]) byDay[k] = [];
      byDay[k].push(ev);
    }

    res.json({ year: y, month, events, byDay });
  } catch (error) {
    res.status(500).json({ message: "Could not load calendar.", error: error.message });
  }
});

/** Public listings — same visibility rules as authenticated player browse (non-cancelled events). */
app.get("/api/public/tournaments", async (_req, res) => {
  try {
    const tournaments = await dbAll(
      `SELECT t.id, t.title, t.category, t.game_mode, t.start_date, t.match_count, t.match_timings, t.map_rotation, t.min_id_level, t.prize_pool, t.max_teams,
       COALESCE(t.organizer_whatsapp, '') AS organizer_whatsapp,
       COALESCE(t.status, 'active') AS status,
       COALESCE(t.registrations_open, 1) AS registrations_open,
       u.email AS organizer_email,
       (SELECT COUNT(*) FROM tournament_applications a WHERE a.tournament_id = t.id AND a.status IN ('applied','approved')) AS used_slots
       FROM tournaments t
       JOIN users u ON u.id = t.organizer_id
       WHERE COALESCE(t.status, 'active') != 'cancelled'
       ORDER BY t.created_at DESC`
    );
    res.json({ tournaments });
  } catch (error) {
    res.status(500).json({ message: "Could not fetch tournaments.", error: error.message });
  }
});

/** Leader-style board: teams with the most approved slots across active (non-cancelled) events. */
app.get("/api/public/rankings", async (_req, res) => {
  try {
    const teams = await dbAll(
      `SELECT
         MIN(TRIM(a.team_name)) AS team_name,
         COUNT(DISTINCT a.tournament_id) AS events_played,
         COUNT(*) AS approved_entries
       FROM tournament_applications a
       JOIN tournaments t ON t.id = a.tournament_id
       WHERE a.status = 'approved'
         AND LENGTH(TRIM(COALESCE(a.team_name, ''))) > 0
         AND COALESCE(t.status, 'active') != 'cancelled'
       GROUP BY LOWER(TRIM(a.team_name))
       ORDER BY events_played DESC, approved_entries DESC, team_name COLLATE NOCASE ASC
       LIMIT 40`
    );
    res.json({ teams });
  } catch (error) {
    res.status(500).json({ message: "Could not load rankings.", error: error.message });
  }
});

app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const existingUser = await dbGet("SELECT id FROM users WHERE email = ?", [email.toLowerCase()]);
    if (existingUser) return res.status(409).json({ message: "Email already registered. Please login." });

    const otp = generateOtp();
    const expiresAt = Date.now() + OTP_TTL_MS;
    const normalizedEmail = email.toLowerCase().trim();

    await dbRun("DELETE FROM otp_verifications WHERE email = ?", [normalizedEmail]);
    await dbRun(
      "INSERT INTO otp_verifications (email, otp, expires_at, verified) VALUES (?, ?, ?, 0)",
      [normalizedEmail, otp, expiresAt]
    );

    const previewUrl = await sendOtpEmail(normalizedEmail, otp);
    res.json({
      message: "OTP sent successfully to your email.",
      previewUrl,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to send OTP.", error: error.message });
  }
});

app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required." });

    const normalizedEmail = email.toLowerCase().trim();
    const record = await dbGet(
      "SELECT id, otp, expires_at FROM otp_verifications WHERE email = ? ORDER BY id DESC LIMIT 1",
      [normalizedEmail]
    );

    if (!record) return res.status(404).json({ message: "No OTP request found for this email." });
    if (Date.now() > record.expires_at) return res.status(410).json({ message: "OTP expired. Request again." });
    if (record.otp !== otp) return res.status(401).json({ message: "Invalid OTP." });

    await dbRun("UPDATE otp_verifications SET verified = 1 WHERE id = ?", [record.id]);
    res.json({ message: "OTP verified. You can now set your password." });
  } catch (error) {
    res.status(500).json({ message: "OTP verification failed.", error: error.message });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ message: "Email, role and password are required." });
    }
    if (!["organizer", "player"].includes(role)) {
      return res.status(400).json({ message: "Role must be organizer or player." });
    }
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });

    const normalizedEmail = email.toLowerCase().trim();
    const verifiedOtp = await dbGet(
      "SELECT id FROM otp_verifications WHERE email = ? AND verified = 1 ORDER BY id DESC LIMIT 1",
      [normalizedEmail]
    );
    if (!verifiedOtp) return res.status(403).json({ message: "Verify OTP before completing signup." });

    const existingUser = await dbGet("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
    if (existingUser) return res.status(409).json({ message: "Email already registered. Please login." });

    const passwordHash = await bcrypt.hash(password, 10);
    await dbRun("INSERT INTO users (email, role, password_hash) VALUES (?, ?, ?)", [
      normalizedEmail,
      role,
      passwordHash,
    ]);
    await dbRun("DELETE FROM otp_verifications WHERE email = ?", [normalizedEmail]);

    res.status(201).json({ message: "Signup completed successfully. Please login." });
  } catch (error) {
    res.status(500).json({ message: "Signup failed.", error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });

    const normalizedEmail = email.toLowerCase().trim();
    const user = await dbGet("SELECT id, email, role, password_hash FROM users WHERE email = ?", [normalizedEmail]);
    if (!user) return res.status(401).json({ message: "Email or password is incorrect." });

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) return res.status(401).json({ message: "Email or password is incorrect." });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "dev-secret-key",
      {
        expiresIn: "1d",
      }
    );

    res.json({
      message: "Login successful.",
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed.", error: error.message });
  }
});

app.get("/api/tournaments", authenticate, async (_req, res) => {
  try {
    const tournaments = await dbAll(
      `SELECT t.id, t.title, t.category, t.game_mode, t.start_date, t.match_count, t.match_timings, t.map_rotation, t.min_id_level, t.prize_pool, t.max_teams, t.organizer_id,
       COALESCE(t.organizer_whatsapp, '') AS organizer_whatsapp,
       COALESCE(t.status, 'active') AS status,
       COALESCE(t.registrations_open, 1) AS registrations_open,
       u.email as organizer_email,
      (SELECT COUNT(*) FROM tournament_applications a WHERE a.tournament_id = t.id AND a.status IN ('applied','approved')) as used_slots
       FROM tournaments t
       JOIN users u ON u.id = t.organizer_id
       WHERE COALESCE(t.status, 'active') != 'cancelled'
       ORDER BY t.created_at DESC`
    );
    res.json({ tournaments });
  } catch (error) {
    res.status(500).json({ message: "Could not fetch tournaments.", error: error.message });
  }
});

app.post("/api/organizer/tournaments", authenticate, requireRole("organizer"), async (req, res) => {
  try {
    const {
      title,
      category,
      gameMode,
      startDate,
      matchCount,
      matchTimings,
      mapRotation,
      minIdLevel,
      prizePool,
      maxTeams,
      organizerWhatsapp,
    } = req.body;
    const whatsapp = String(organizerWhatsapp ?? "").trim();
    if (!title || !category || !gameMode || !startDate) {
      return res.status(400).json({ message: "Title, category, game mode and start date are required." });
    }
    if (!matchCount || !matchTimings || !mapRotation) {
      return res.status(400).json({ message: "Match count, timings and map rotation are required." });
    }
    if (!minIdLevel || Number(minIdLevel) < 1) {
      return res.status(400).json({ message: "Minimum ID level must be at least 1." });
    }
    if (!whatsapp) {
      return res.status(400).json({ message: "Organizer WhatsApp number is required." });
    }

    await dbRun(
      `INSERT INTO tournaments (title, category, game_mode, start_date, match_count, match_timings, map_rotation, min_id_level, prize_pool, max_teams, organizer_whatsapp, organizer_id, status, registrations_open)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1)`,
      [
        title,
        category,
        gameMode,
        startDate,
        Number(matchCount),
        matchTimings,
        mapRotation,
        Number(minIdLevel),
        prizePool || "",
        Number(maxTeams) || null,
        whatsapp,
        req.user.id,
      ]
    );
    return res.status(201).json({ message: "Tournament/Scrim created successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create tournament.", error: error.message });
  }
});

app.post("/api/player/apply/:tournamentId", authenticate, requireRole("player"), async (req, res) => {
  try {
    const { teamName, iglContact, playerUid, playerIgn, playerIdLevel } = req.body;
    if (!teamName || !iglContact || !playerUid || !playerIgn || !playerIdLevel) {
      return res.status(400).json({ message: "Team name, IGL contact, UID, IGN and ID level are required." });
    }

    const tournamentId = Number(req.params.tournamentId);
    if (!tournamentId) return res.status(400).json({ message: "Valid tournament id required." });

    const tournament = await dbGet(
      "SELECT id, max_teams, min_id_level, COALESCE(status,'active') AS status, COALESCE(registrations_open,1) AS registrations_open FROM tournaments WHERE id = ?",
      [tournamentId]
    );
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });
    if (tournament.status === "cancelled") {
      return res.status(410).json({ message: "This event has been cancelled." });
    }
    if (!Number(tournament.registrations_open)) {
      return res.status(403).json({ message: "Registrations are closed for this event." });
    }

    const usedSlots = await dbGet(
      "SELECT COUNT(*) as count FROM tournament_applications WHERE tournament_id = ? AND status IN ('applied','approved')",
      [tournamentId]
    );
    if (tournament.max_teams && usedSlots.count >= tournament.max_teams) {
      return res.status(409).json({ message: "No slots available for this tournament." });
    }
    if (Number(playerIdLevel) < Number(tournament.min_id_level)) {
      return res
        .status(403)
        .json({ message: `Minimum ID level required is ${tournament.min_id_level}.` });
    }

    await dbRun(
      `INSERT INTO tournament_applications
      (tournament_id, player_id, team_name, igl_contact, player_uid, player_ign, player_id_level)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tournamentId, req.user.id, teamName, iglContact, playerUid, playerIgn, Number(playerIdLevel)]
    );
    return res.status(201).json({ message: "Applied successfully." });
  } catch (error) {
    if (error.message.includes("UNIQUE")) {
      return res.status(409).json({ message: "You already applied for this tournament/scrim." });
    }
    return res.status(500).json({ message: "Failed to apply.", error: error.message });
  }
});

app.get("/api/player/applications", authenticate, requireRole("player"), async (req, res) => {
  try {
    const applications = await dbAll(
      `SELECT a.id, a.status, a.created_at, t.id as tournament_id, t.title, t.category, t.start_date,
       COALESCE(t.status, 'active') AS tournament_status,
       COALESCE(t.registrations_open, 1) AS tournament_registrations_open
       FROM tournament_applications a
       JOIN tournaments t ON t.id = a.tournament_id
       WHERE a.player_id = ?
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    res.json({ applications });
  } catch (error) {
    res.status(500).json({ message: "Could not fetch applications.", error: error.message });
  }
});

/** Full event + the player’s own application row (only if they registered for this tournament). */
app.get("/api/player/tournaments/:tournamentId/details", authenticate, requireRole("player"), async (req, res) => {
  try {
    const tournamentId = Number(req.params.tournamentId);
    if (!tournamentId) return res.status(400).json({ message: "Valid tournament id required." });

    const application = await dbGet(
      `SELECT id, status, team_name, igl_contact, player_uid, player_ign, player_id_level, created_at, tournament_id
       FROM tournament_applications
       WHERE tournament_id = ? AND player_id = ?`,
      [tournamentId, req.user.id]
    );
    if (!application) {
      return res.status(404).json({ message: "You are not registered for this event." });
    }

    const tournament = await dbGet(
      `SELECT t.id, t.title, t.category, t.game_mode, t.start_date, t.match_count, t.match_timings, t.map_rotation,
        t.min_id_level, t.prize_pool, t.max_teams,
        COALESCE(t.organizer_whatsapp, '') AS organizer_whatsapp,
        COALESCE(t.status, 'active') AS status,
        COALESCE(t.registrations_open, 1) AS registrations_open,
        t.created_at AS event_created_at,
        u.email AS organizer_email,
        (SELECT COUNT(*) FROM tournament_applications a2
          WHERE a2.tournament_id = t.id AND a2.status IN ('applied','approved')) AS used_slots
       FROM tournaments t
       JOIN users u ON u.id = t.organizer_id
       WHERE t.id = ?`,
      [tournamentId]
    );
    if (!tournament) {
      return res.status(404).json({ message: "Event not found." });
    }

    return res.json({ tournament, application });
  } catch (error) {
    return res.status(500).json({ message: "Could not load event details.", error: error.message });
  }
});

app.get("/api/organizer/tournaments", authenticate, requireRole("organizer"), async (req, res) => {
  try {
    const tournaments = await dbAll(
      `SELECT t.*,
      (SELECT COUNT(*) FROM tournament_applications a WHERE a.tournament_id = t.id AND a.status IN ('applied','approved')) as used_slots,
      (SELECT COUNT(*) FROM tournament_applications a WHERE a.tournament_id = t.id AND a.status = 'approved') as approved_count
      FROM tournaments t
      WHERE t.organizer_id = ?
      ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json({ tournaments });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch organizer tournaments.", error: error.message });
  }
});

app.get(
  "/api/organizer/tournaments/:tournamentId/applicants",
  authenticate,
  requireRole("organizer"),
  async (req, res) => {
    try {
      const tournamentId = Number(req.params.tournamentId);
      const tournament = await dbGet("SELECT id, organizer_id FROM tournaments WHERE id = ?", [tournamentId]);
      const oid = tournament ? Number(tournament.organizer_id) : null;
      const uid = Number(req.user.id);
      if (!tournament || oid !== uid) {
        return res.status(404).json({ message: "Tournament not found." });
      }

      const applicants = await dbAll(
        `SELECT a.id, a.status, a.team_name, a.igl_contact, a.player_uid, a.player_ign, a.player_id_level, a.created_at,
        u.email as player_email
        FROM tournament_applications a
        JOIN users u ON u.id = a.player_id
        WHERE a.tournament_id = ?
        ORDER BY a.created_at DESC`,
        [tournamentId]
      );
      return res.json({ applicants });
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch applicants.", error: error.message });
    }
  }
);

app.patch("/api/organizer/applications/:applicationId", authenticate, requireRole("organizer"), async (req, res) => {
  try {
    const applicationId = Number(req.params.applicationId);
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be approved or rejected." });
    }

    const application = await dbGet(
      `SELECT a.id, a.status, a.tournament_id, t.organizer_id, COALESCE(t.status,'active') AS tournament_status
      FROM tournament_applications a
      JOIN tournaments t ON t.id = a.tournament_id
      WHERE a.id = ?`,
      [applicationId]
    );
    if (!application || Number(application.organizer_id) !== Number(req.user.id)) {
      return res.status(404).json({ message: "Application not found." });
    }
    if (application.tournament_status === "cancelled") {
      return res.status(410).json({ message: "This event has been cancelled." });
    }

    if (status === "approved") {
      const tournament = await dbGet("SELECT id, max_teams FROM tournaments WHERE id = ?", [application.tournament_id]);
      const usedSlots = await dbGet(
        "SELECT COUNT(*) as count FROM tournament_applications WHERE tournament_id = ? AND status IN ('applied','approved')",
        [application.tournament_id]
      );
      if (tournament.max_teams && usedSlots.count > tournament.max_teams) {
        return res.status(409).json({ message: "No slots available." });
      }
    }

    await dbRun("UPDATE tournament_applications SET status = ? WHERE id = ?", [status, applicationId]);
    return res.json({ message: `Application ${status}.` });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update application.", error: error.message });
  }
});

app.patch("/api/organizer/tournaments/:tournamentId", authenticate, requireRole("organizer"), async (req, res) => {
  try {
    const tournamentId = Number(req.params.tournamentId);
    if (!tournamentId) return res.status(400).json({ message: "Valid tournament id required." });

    const existing = await dbGet(
      "SELECT id, organizer_id FROM tournaments WHERE id = ?",
      [tournamentId]
    );
    if (!existing || Number(existing.organizer_id) !== Number(req.user.id)) {
      return res.status(404).json({ message: "Tournament not found." });
    }

    const {
      title,
      category,
      gameMode,
      startDate,
      matchCount,
      matchTimings,
      mapRotation,
      minIdLevel,
      prizePool,
      maxTeams,
      organizerWhatsapp,
      registrationsOpen,
      status,
    } = req.body;

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push("title = ?");
      params.push(title);
    }
    if (category !== undefined) {
      updates.push("category = ?");
      params.push(category);
    }
    if (gameMode !== undefined) {
      updates.push("game_mode = ?");
      params.push(gameMode);
    }
    if (startDate !== undefined) {
      updates.push("start_date = ?");
      params.push(startDate);
    }
    if (matchCount !== undefined) {
      updates.push("match_count = ?");
      params.push(Number(matchCount));
    }
    if (matchTimings !== undefined) {
      updates.push("match_timings = ?");
      params.push(matchTimings);
    }
    if (mapRotation !== undefined) {
      updates.push("map_rotation = ?");
      params.push(mapRotation);
    }
    if (minIdLevel !== undefined) {
      updates.push("min_id_level = ?");
      params.push(Number(minIdLevel));
    }
    if (prizePool !== undefined) {
      updates.push("prize_pool = ?");
      params.push(prizePool);
    }
    if (maxTeams !== undefined) {
      updates.push("max_teams = ?");
      params.push(maxTeams === "" || maxTeams == null ? null : Number(maxTeams));
    }
    if (organizerWhatsapp !== undefined) {
      const w = String(organizerWhatsapp).trim();
      if (!w) {
        return res.status(400).json({ message: "Organizer WhatsApp number cannot be empty." });
      }
      updates.push("organizer_whatsapp = ?");
      params.push(w);
    }
    if (registrationsOpen !== undefined) {
      updates.push("registrations_open = ?");
      params.push(registrationsOpen ? 1 : 0);
    }
    if (status !== undefined) {
      if (!["active", "cancelled"].includes(status)) {
        return res.status(400).json({ message: "Status must be active or cancelled." });
      }
      updates.push("status = ?");
      params.push(status);
      if (status === "cancelled") {
        updates.push("registrations_open = ?");
        params.push(0);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No fields to update." });
    }

    params.push(tournamentId);
    await dbRun(`UPDATE tournaments SET ${updates.join(", ")} WHERE id = ?`, params);
    if (status === "cancelled") {
      await dbRun(
        `UPDATE tournament_applications SET status = 'cancelled' WHERE tournament_id = ? AND status IN ('applied', 'approved')`,
        [tournamentId]
      );
    }
    const message = status === "cancelled" ? "Event cancelled." : "Event updated.";
    return res.json({ message });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update event.", error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
