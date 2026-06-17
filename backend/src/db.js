const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "..", "tournament.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'player',
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'player'", () => {});

  db.run(`
    CREATE TABLE IF NOT EXISTS otp_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      otp TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      game_mode TEXT NOT NULL,
      start_date TEXT NOT NULL,
      match_count INTEGER NOT NULL DEFAULT 1,
      match_timings TEXT NOT NULL DEFAULT '',
      map_rotation TEXT NOT NULL DEFAULT '',
      min_id_level INTEGER NOT NULL DEFAULT 1,
      prize_pool TEXT,
      max_teams INTEGER,
      organizer_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organizer_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tournament_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      team_name TEXT NOT NULL DEFAULT '',
      igl_contact TEXT NOT NULL DEFAULT '',
      player_uid TEXT NOT NULL DEFAULT '',
      player_ign TEXT NOT NULL DEFAULT '',
      player_id_level INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'applied',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tournament_id, player_id),
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
      FOREIGN KEY (player_id) REFERENCES users(id)
    )
  `);

  db.run("ALTER TABLE tournaments ADD COLUMN match_count INTEGER NOT NULL DEFAULT 1", () => {});
  db.run("ALTER TABLE tournaments ADD COLUMN match_timings TEXT NOT NULL DEFAULT ''", () => {});
  db.run("ALTER TABLE tournaments ADD COLUMN map_rotation TEXT NOT NULL DEFAULT ''", () => {});
  db.run("ALTER TABLE tournaments ADD COLUMN min_id_level INTEGER NOT NULL DEFAULT 1", () => {});
  db.run("ALTER TABLE tournament_applications ADD COLUMN team_name TEXT NOT NULL DEFAULT ''", () => {});
  db.run("ALTER TABLE tournament_applications ADD COLUMN igl_contact TEXT NOT NULL DEFAULT ''", () => {});
  db.run("ALTER TABLE tournament_applications ADD COLUMN player_uid TEXT NOT NULL DEFAULT ''", () => {});
  db.run("ALTER TABLE tournament_applications ADD COLUMN player_ign TEXT NOT NULL DEFAULT ''", () => {});
  db.run("ALTER TABLE tournament_applications ADD COLUMN player_id_level INTEGER NOT NULL DEFAULT 1", () => {});

  db.run("ALTER TABLE tournaments ADD COLUMN status TEXT DEFAULT 'active'", () => {});
  db.run("ALTER TABLE tournaments ADD COLUMN registrations_open INTEGER DEFAULT 1", () => {});
  db.run("ALTER TABLE tournaments ADD COLUMN organizer_whatsapp TEXT NOT NULL DEFAULT ''", () => {});
  db.run(
    "UPDATE tournaments SET registrations_open = 0 WHERE LOWER(TRIM(COALESCE(status, ''))) = 'cancelled' AND COALESCE(registrations_open, 1) != 0",
    () => {}
  );
  db.run(
    `UPDATE tournament_applications SET status = 'cancelled'
     WHERE status IN ('applied', 'approved')
     AND tournament_id IN (SELECT id FROM tournaments WHERE LOWER(TRIM(COALESCE(status, ''))) = 'cancelled')`,
    () => {}
  );
});

module.exports = db;
