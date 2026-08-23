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
    }

    // --- MIGRATION: Fix Broken FKs (Sales/Tickets -> shifts_old) ---
    try {
        // Function to check table existence
        const tableExists = async (name) => {
             const rs = await db.execute({ sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?", args: [name] });
             return rs.rows.length > 0;
        };

        const salesBroken = await (async () => {
             const fkList = await db.execute("PRAGMA foreign_key_list('sales')");
             for (const row of fkList.rows) {
                 if (row.table === 'shifts_old' || (Array.isArray(row) && row.includes('shifts_old'))) return true;
             }
             return false;
        })();
        
        // Also check if we are in a mid-migration state (old_fix tables exist)
        const ticketsFixExists = await tableExists('tickets_old_fix');
        const salesFixExists = await tableExists('sales_old_fix');

        if (salesBroken || ticketsFixExists || salesFixExists) {
            console.log("Detected broken FKs or incomplete repair. Repairing...");
            
            // Disable FKs just in case, though order should handle it
            await db.execute("PRAGMA foreign_keys = OFF");

            await db.transaction('write');
            
            // 1. Rename BOTH first to free up names (if not already renamed)
            if (!ticketsFixExists) {
                 console.log("Renaming tickets to tickets_old_fix...");
                 await db.execute("ALTER TABLE tickets RENAME TO tickets_old_fix");
            }
            if (!salesFixExists) {
                 console.log("Renaming sales to sales_old_fix...");
                 await db.execute("ALTER TABLE sales RENAME TO sales_old_fix");
            }

            // 2. Create NEW tables
            console.log("Creating new tables...");
            await db.execute(`
              CREATE TABLE IF NOT EXISTS tickets (
                id TEXT PRIMARY KEY,
                shift_id INTEGER NOT NULL,
                total INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                paid_at DATETIME,
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
            
            // 3. Copy Data
            console.log("Copying tickets data...");
            await db.execute(`
                INSERT OR IGNORE INTO tickets (id, shift_id, total, created_at, paid_at)
                SELECT id, shift_id, total, created_at, paid_at 
                FROM tickets_old_fix
                WHERE shift_id IN (SELECT id FROM shifts)
            `);
            
            console.log("Copying sales data...");
            await db.execute(`
                INSERT OR IGNORE INTO sales (id, shift_id, ticket_id, number, amount, prize, created_at)
                SELECT id, shift_id, ticket_id, number, amount, prize, created_at
                FROM sales_old_fix
                WHERE shift_id IN (SELECT id FROM shifts)
                AND (ticket_id IS NULL OR ticket_id IN (SELECT id FROM tickets))
            `);

            // 4. Drop OLD tables (Sales FIRST because it depends on Tickets)
            console.log("Dropping old tables...");
            await db.execute("DROP TABLE IF EXISTS sales_old_fix");
            await db.execute("DROP TABLE IF EXISTS tickets_old_fix"); // Now safe to drop
            
            // 5. Re-create indexes
            await db.execute("CREATE INDEX IF NOT EXISTS idx_tickets_shift_id ON tickets(shift_id)");
            await db.execute("CREATE INDEX IF NOT EXISTS idx_sales_shift_id ON sales(shift_id)");
            await db.execute("CREATE INDEX IF NOT EXISTS idx_sales_ticket_id ON sales(ticket_id)");
            await db.execute("CREATE INDEX IF NOT EXISTS idx_sales_shift_number ON sales(shift_id, number)");

            console.log("Foreign Key Repair Completed.");
        }

    } catch (e) {
        console.error("FK Repair Failed:", e);
    }

    // --- MIGRATION: Deduplicate shifts and enforce UNIQUE constraint ---
    try {
        const dupesRs = await db.execute(`
            SELECT date, type, COUNT(*) as count 
            FROM shifts 
            WHERE type != 'Prueba' 
            GROUP BY date, type 
            HAVING count > 1
        `);

        if (dupesRs.rows && dupesRs.rows.length > 0) {
            console.log(`Found ${dupesRs.rows.length} duplicate shift groups. Consolidating...`);
            for (const row of dupesRs.rows) {
                const shiftDate = row.date;
                const shiftType = row.type;

                const shiftsForGroup = await db.execute({
                    sql: "SELECT * FROM shifts WHERE date = ? AND type = ? ORDER BY id ASC",
                    args: [shiftDate, shiftType]
                });

                const rows = shiftsForGroup.rows;
                if (rows.length > 1) {
                    // Pick primary: prefer one with total_sales > 0, otherwise the latest (highest ID)
                    const primary = rows.slice().sort((a, b) => (Number(b.total_sales) || 0) - (Number(a.total_sales) || 0) || Number(b.id) - Number(a.id))[0];
                    const duplicates = rows.filter(r => r.id !== primary.id);

                    for (const dup of duplicates) {
                        console.log(`Consolidating duplicate shift ID ${dup.id} into primary shift ID ${primary.id} (${shiftDate} - ${shiftType})`);
                        await db.execute({
                            sql: "UPDATE tickets SET shift_id = ? WHERE shift_id = ?",
                            args: [primary.id, dup.id]
                        });
                        await db.execute({
                            sql: "UPDATE sales SET shift_id = ? WHERE shift_id = ?",
                            args: [primary.id, dup.id]
                        });
                        await db.execute({
                            sql: "DELETE FROM shift_counters WHERE shift_id = ?",
                            args: [dup.id]
                        });
                        await db.execute({
                            sql: "DELETE FROM shifts WHERE id = ?",
                            args: [dup.id]
                        });
                    }

                    // Recalculate counters and totals for primary shift
                    await db.execute({
                        sql: "DELETE FROM shift_counters WHERE shift_id = ?",
                        args: [primary.id]
                    });
                    await db.execute({
                        sql: `INSERT INTO shift_counters (shift_id, number, amount, count)
                              SELECT shift_id, number, SUM(amount), COUNT(*)
                              FROM sales
                              WHERE shift_id = ?
                              GROUP BY shift_id, number`,
                        args: [primary.id]
                    });
                    const totalRs = await db.execute({
                        sql: "SELECT IFNULL(SUM(amount), 0) as total, (SELECT COUNT(*) FROM tickets WHERE shift_id = ?) as ticket_count FROM sales WHERE shift_id = ?",
                        args: [primary.id, primary.id]
                    });
                    const newTotal = totalRs.rows[0]?.total || 0;
                    const newTicketCount = totalRs.rows[0]?.ticket_count || 0;
                    await db.execute({
                        sql: "UPDATE shifts SET total_sales = ?, ticket_count = ? WHERE id = ?",
                        args: [newTotal, newTicketCount, primary.id]
                    });
                }
            }
            console.log("Shifts consolidation completed.");
        }

        // Create UNIQUE index for regular shifts per date
        await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_date_type_unique ON shifts(date, type) WHERE type != 'Prueba'");
        console.log("Unique shift index ensured.");
    } catch (e) {
        console.error("Shifts deduplication / unique index error:", e);
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
