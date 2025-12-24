const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "pos.db"));

try {
    console.log("Resetting database...");
    
    // Clear transactional tables
    db.prepare("DELETE FROM sales").run();
    console.log("Deleted all sales.");

    db.prepare("DELETE FROM tickets").run();
    console.log("Deleted all tickets.");

    db.prepare("DELETE FROM shifts").run();
    console.log("Deleted all shifts.");

    // Reset Auto-Increment
    db.prepare("DELETE FROM sqlite_sequence WHERE name='sales'").run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name='shifts'").run();
    console.log("Reset ID counters.");

    console.log("Database reset complete. Configuration preserved.");
} catch (e) {
    console.error("Error resetting database:", e);
}
