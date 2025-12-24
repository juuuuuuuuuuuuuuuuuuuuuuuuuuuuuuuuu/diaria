const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs"); // Added

const db = new Database(path.join(__dirname, "pos.db"), {
  verbose: console.log,
});

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    limit_per_number INTEGER DEFAULT 350,
    limit_total_shift INTEGER DEFAULT 5000,
    system_retention INTEGER DEFAULT 5,
    shift_schedule TEXT DEFAULT '{"morning":"08:00-12:00","afternoon":"13:00-18:00","night":"19:00-22:00"}',
    whatsapp_number TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('Mañana', 'Tarde', 'Noche')) NOT NULL,
    date TEXT NOT NULL,
    status TEXT CHECK(status IN ('ABIERTO', 'CERRADO', 'FINALIZADO')) DEFAULT 'ABIERTO',
    winning_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    shift_id INTEGER NOT NULL,
    total INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(shift_id) REFERENCES shifts(id)
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER NOT NULL,
    ticket_id TEXT,
    number TEXT NOT NULL CHECK(length(number) = 2),
    amount INTEGER NOT NULL CHECK(amount > 0),
    prize INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(shift_id) REFERENCES shifts(id),
    FOREIGN KEY(ticket_id) REFERENCES tickets(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add ticket_id to sales if it doesn't exist (for existing databases)
try {
  db.prepare("ALTER TABLE sales ADD COLUMN ticket_id TEXT").run();
} catch (e) {
  // Column likely exists, ignore
}

// Seed Config
const stmtConfig = db.prepare("INSERT OR IGNORE INTO config (id) VALUES (1)");
stmtConfig.run();

// Seed Admin User
try {
  const adminExists = db.prepare("SELECT 1 FROM users WHERE username = 'admin'").get();
  if (!adminExists) {
    console.log("Seeding default admin user...");
    const hash = bcrypt.hashSync("admin123", 10);
    db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run('admin', hash, 'admin');
    console.log("Admin user created.");
  }
} catch (e) {
  console.error("Error seeding admin:", e);
}

module.exports = db;
