const db = require('./db');
const bcrypt = require('bcryptjs');

async function init() {
  console.log("Initializing Database Schema...");

  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        limit_per_number INTEGER DEFAULT 350,
        limit_total_shift INTEGER DEFAULT 5000,
        system_retention INTEGER DEFAULT 5,
        prize_multiplier INTEGER DEFAULT 70,
        shift_schedule TEXT DEFAULT '{"morning":"08:00-12:00","afternoon":"13:00-18:00","night":"19:00-22:00"}',
        whatsapp_number TEXT DEFAULT ''
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT CHECK(type IN ('Mañana', 'Tarde', 'Noche')) NOT NULL,
        date TEXT NOT NULL,
        status TEXT CHECK(status IN ('ABIERTO', 'CERRADO', 'FINALIZADO')) DEFAULT 'ABIERTO',
        winning_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        shift_id INTEGER NOT NULL,
        total INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(shift_id) REFERENCES shifts(id)
      )
    `);

    await db.execute(`
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
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS shift_counters (
        shift_id INTEGER,
        number TEXT,
        amount INTEGER DEFAULT 0,
        count INTEGER DEFAULT 0,
        PRIMARY KEY (shift_id, number)
      )
    `);

    // --- INDEXES (Optimization) ---
    await db.execute("CREATE INDEX IF NOT EXISTS idx_sales_shift_id ON sales(shift_id)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_sales_ticket_id ON sales(ticket_id)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_sales_shift_number ON sales(shift_id, number)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_tickets_shift_id ON tickets(shift_id)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date)");

    // Migration for shifts column (Ignore if exists)
    try {
        await db.execute("ALTER TABLE shifts ADD COLUMN total_sales INTEGER DEFAULT 0");
    } catch(e) {}
    
    try {
        await db.execute("ALTER TABLE shifts ADD COLUMN ticket_count INTEGER DEFAULT 0");
    } catch(e) {}

    // Migration for tickets paid_at
    try {
        await db.execute("ALTER TABLE tickets ADD COLUMN paid_at DATETIME");
    } catch(e) {}

    // Migration for config prize_multiplier
    try {
        await db.execute("ALTER TABLE config ADD COLUMN prize_multiplier INTEGER DEFAULT 70");
    } catch(e) {}

    // Backfill Migration (Optimized for Turso/LibSQL)
    try {
        const rs = await db.execute("SELECT count(*) as c FROM shift_counters");
        // Access row safely depending on client version (rs.rows[0].c or rs.rows[0][0])
        // Assuming rs.rows is array of objects from previous usage
        const count = rs.rows[0]?.c || 0;
        
        if (count == 0) {
            console.log("Migrating sales data to optimized counters...");
            
            // Backfill shift_counters
            await db.execute(`
                 INSERT INTO shift_counters (shift_id, number, amount, count) 
                 SELECT shift_id, number, SUM(amount), COUNT(*) 
                 FROM sales 
                 GROUP BY shift_id, number
            `);

            // Backfill shifts totals
            // Note: SQLite doesn't support UPDATE FROM syntax efficiently in all versions, using correlated subquery
            await db.execute(`
                UPDATE shifts 
                SET total_sales = (
                    SELECT IFNULL(SUM(amount), 0) 
                    FROM sales 
                    WHERE sales.shift_id = shifts.id
                )
            `);
            console.log("Migration completed.");
        }
    } catch (e) {
        console.error("Migration error (non-critical if table exists):", e);
    }

    // --- MIGRATION: Test Shifts (Schema Change) ---
    try {
        // Check if is_test column exists
        let needsMigration = false;
        try {
            await db.execute("SELECT is_test FROM shifts LIMIT 1");
        } catch (e) {
            needsMigration = true;
        }

        if (needsMigration) {
            console.log("Migrating shifts table for Test Mode...");
            await db.transaction('write'); // Start transaction if possible, or just sequential
            
            // 1. Rename old table
            await db.execute("ALTER TABLE shifts RENAME TO shifts_old");

            // 2. Create new table (including is_test, new CHECK, and previous alter columns)
            await db.execute(`
              CREATE TABLE shifts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT CHECK(type IN ('Mañana', 'Tarde', 'Noche', 'Prueba')) NOT NULL,
                date TEXT NOT NULL,
                status TEXT CHECK(status IN ('ABIERTO', 'CERRADO', 'FINALIZADO')) DEFAULT 'ABIERTO',
                winning_number TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                closed_at DATETIME,
                total_sales INTEGER DEFAULT 0,
                ticket_count INTEGER DEFAULT 0,
                is_test INTEGER DEFAULT 0
              )
            `);

            // 3. Copy data (Handling missing columns with defaults)
            // Note: shifts_old has total_sales and ticket_count from previous ALTERS? 
            // We need to be careful. usage of "SELECT * " relies on column order.
            // Better to specify columns.
            
            // Get columns from shifts_old to construct query dynamically or just assume standard
            // We know the previous schema state: 
            // id, type, date, status, winning_number, created_at, closed_at, total_sales, ticket_count (added via ALTER)
            
            await db.execute(`
                INSERT INTO shifts (id, type, date, status, winning_number, created_at, closed_at, total_sales, ticket_count)
                SELECT id, type, date, status, winning_number, created_at, closed_at, total_sales, ticket_count
                FROM shifts_old
            `);

            // 4. Drop old table
            await db.execute("DROP TABLE shifts_old");

            // 5. Re-create Index
            await db.execute("CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date)");
            
            console.log("Shifts table migration completed.");
        }
    } catch (e) {
        console.error("Test Shift Migration Failed:", e);
        // If it failed, we might be in a bad state if not transactional. 
        // But LibSQL via HTTP might not support multi-statement transactions in one go easily without the transaction helper.
        // Assuming the user runs this local node script which uses local db or http client.
    }

    // Seed Config
    try {
        await db.execute("INSERT INTO config (id) VALUES (1)");
        console.log("Config seeded.");
    } catch (e) { 
        // Ignore if exists
    }

    // Seed Admin
    try {
        const rs = await db.execute({ sql: "SELECT * FROM users WHERE username = ?", args: ['admin'] });
        if (rs.rows.length === 0) {
            console.log("Seeding admin...");
            const hash = bcrypt.hashSync("admin123", 10);
            await db.execute({ sql: "INSERT INTO users (username, password, role) VALUES (?, ?, ?)", args: ['admin', hash, 'admin'] });
        }
    } catch (e) {
        console.error("Error seeding admin", e);
    }
    
    console.log("Database initialized successfully.");
  } catch (e) {
    console.error("Initialization failed:", e);
  }
}

init();
