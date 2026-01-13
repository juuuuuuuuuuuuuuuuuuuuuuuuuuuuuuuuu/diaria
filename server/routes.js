const express = require('express');
const router = express.Router();
const db = require('./db');
const { format } = require('date-fns');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, SECRET_KEY } = require('./middleware/auth');
const { toZonedTime, format: formatTz } = require('date-fns-tz');

const TIMEZONE = 'America/Tegucigalpa';

// Helper to get current date in Honduras timezone
const getBusinessDate = () => {
    const now = new Date();
    const zonedDate = toZonedTime(now, TIMEZONE);
    return formatTz(zonedDate, 'yyyy-MM-dd', { timeZone: TIMEZONE });
};

const getBusinessDateTime = () => {
    const now = new Date();
    const zonedDate = toZonedTime(now, TIMEZONE);
    return formatTz(zonedDate, 'yyyy-MM-dd HH:mm:ss', { timeZone: TIMEZONE });
};

// --- HELPERS ---

// Helper to execute and get first result (simulate .get())
async function dbGet(sql, args = []) {
  const rs = await db.execute({ sql, args });
  return rs.rows.length > 0 ? rs.rows[0] : null;
}

// Helper to execute and get all results (simulate .all())
async function dbAll(sql, args = []) {
  const rs = await db.execute({ sql, args });
  return rs.rows;
}

// Helper to execute and get info (simulate .run())
async function dbRun(sql, args = []) {
  const rs = await db.execute({ sql, args });
  return { lastInsertRowid: rs.lastInsertRowid, changes: rs.rowsAffected };
}

const getActiveShift = async () => {
    return await dbGet("SELECT * FROM shifts WHERE status = 'ABIERTO'");
};

const getConfig = async () => {
    return await dbGet("SELECT * FROM config WHERE id = 1");
};

// --- ROUTES ---

// 0. AUTHENTICATION
router.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        // Check user
        const user = await dbGet("SELECT * FROM users WHERE username = ?", [username]);
        if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

        // Check password
        if (!bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        // Generate Token
        // Encode only necessary data
        const payload = { id: user.id, username: user.username, role: user.role };
        const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '12h' });
        
        res.json({ token, user: payload });
    } catch (e) {
        console.error("Login Error:", e);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Users Management (Protected)
router.get('/users', authenticateToken, async (req, res) => {
    try {
        const users = await dbAll("SELECT id, username, role, created_at FROM users");
        res.json(users);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/users', authenticateToken, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Datos incompletos" });

    try {
        const hash = bcrypt.hashSync(password, 10);
        const info = await dbRun("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash]);
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
        res.status(400).json({ error: "El usuario ya existe o error en base de datos." });
    }
});

router.put('/users/:id/password', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    
    try {
        const hash = bcrypt.hashSync(password, 10);
        await dbRun("UPDATE users SET password = ? WHERE id = ?", [hash, id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/users/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    if (req.user.id == id) return res.status(400).json({ error: "No puedes eliminar tu propio usuario." });

    try {
        await dbRun("DELETE FROM users WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// 1. CONFIG
router.get('/config', async (req, res) => {
    try {
        const config = await getConfig();
        if (config && config.shift_schedule) {
            // Check if it's already an object or string (LibSQL might return string for TEXT types)
            if (typeof config.shift_schedule === 'string') {
                 config.shift_schedule = JSON.parse(config.shift_schedule);
            }
        }
        res.json(config);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/config', async (req, res) => {
    const { limit_per_number, limit_total_shift, system_retention, shift_schedule, whatsapp_number } = req.body;
    try {
        await dbRun(`
            UPDATE config SET 
            limit_per_number = ?,
            limit_total_shift = ?,
            system_retention = ?,
            shift_schedule = ?,
            whatsapp_number = ?
            WHERE id = 1
        `, [limit_per_number, limit_total_shift, system_retention, JSON.stringify(shift_schedule), whatsapp_number]);
        
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// 2. SHIFTS
router.get('/shifts/day-status', async (req, res) => {
    try {
        const today = getBusinessDate();
        const shifts = await dbAll("SELECT type, status, id FROM shifts WHERE date = ?", [today]);
        
        const status = {
            'Mañana': null,
            'Tarde': null,
            'Noche': null
        };
        shifts.forEach(s => { status[s.type] = s; });
        res.json({ date: today, shifts: status });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/shifts/current', async (req, res) => {
    try {
        const shift = await dbGet("SELECT * FROM shifts WHERE status = 'ABIERTO' ORDER BY id DESC LIMIT 1");
        res.json(shift || null);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/shifts/open', async (req, res) => {
    const { type } = req.body;
    const today = getBusinessDate();

    try {
        // Check availability
        const existing = await dbGet("SELECT * FROM shifts WHERE date = ? AND type = ?", [today, type]);
        
        if (existing) {
            if (existing.status === 'ABIERTO') {
                return res.json({ success: true, id: existing.id, resumed: true });
            } else {
                return res.status(400).json({ error: `El turno de la ${type} ya está ${existing.status}.` });
            }
        }

        // Check max shifts
        const shiftsToday = await dbGet("SELECT COUNT(*) as count FROM shifts WHERE date = ?", [today]);
        if (shiftsToday.count >= 3) {
            return res.status(400).json({ error: "Límite de turnos diarios (3) alcanzado." });
        }

        const info = await dbRun("INSERT INTO shifts (type, date, status, created_at) VALUES (?, ?, 'ABIERTO', ?)", [type, today, getBusinessDateTime()]);
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/shifts/close', async (req, res) => {
    const { shift_id, winning_number } = req.body;
    if (!shift_id) return res.status(400).json({ error: "Shift ID Required" });

    let status = 'CERRADO';
    if (winning_number) status = 'FINALIZADO';

    try {
        // LibSQL requires proper args binding
        await dbRun("UPDATE shifts SET status = ?, winning_number = ?, closed_at = ? WHERE id = ?", [status, winning_number || null, getBusinessDateTime(), shift_id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/shifts/:id/simulate-winner', async (req, res) => {
    const { id } = req.params;
    const { number } = req.query;

    if (!number) return res.json({ winner_count: 0, total_prizes: 0, total_sold: 0 });

    try {
        const stats = await dbGet(`
            SELECT 
                COUNT(*) as winner_count,
                SUM(prize) as total_prizes,
                (SELECT SUM(amount) FROM sales WHERE shift_id = ? AND number = ?) as total_sold
            FROM sales 
            WHERE shift_id = ? AND number = ?
        `, [id, number, id, number]);

        res.json({
            winner_count: stats?.winner_count || 0,
            total_prizes: stats?.total_prizes || 0,
            total_sold: stats?.total_sold || 0
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/shifts/:id/report', async (req, res) => {
    const { id } = req.params;
    try {
        const sales = await dbAll(`
            SELECT number, SUM(amount) as total_amount 
            FROM sales 
            WHERE shift_id = ? 
            GROUP BY number
        `, [id]);

        const shift = await dbGet("SELECT * FROM shifts WHERE id = ?", [id]);
        const totalSold = sales.reduce((acc, curr) => acc + curr.total_amount, 0);

        res.json({ shift, sales, totalSold });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. SALES
router.post('/sales/bulk', async (req, res) => {
    const { items, shift_id } = req.body;
    
    if (!shift_id) return res.status(400).json({ error: "Shift ID Required" });
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "No items provided" });

    try {
        const activeShift = await dbGet("SELECT * FROM shifts WHERE id = ?", [shift_id]);
        if (!activeShift || activeShift.status !== 'ABIERTO') {
            return res.status(400).json({ error: "El turno no está abierto." });
        }
        
        const config = await getConfig();
        const tx = await db.transaction('write'); // Start transaction

        try {
            const errors = [];
            let totalBatchAmount = 0;
            const batchTotals = {}; // { '05': 100 }

            for (const item of items) {
                if (item.amount % 5 !== 0) {
                     errors.push({ number: item.number, error: "Múltiplo de 5 requerido" });
                     continue;
                }
                batchTotals[item.number] = (batchTotals[item.number] || 0) + item.amount;
                totalBatchAmount += item.amount;
            }

            if (errors.length > 0) throw { type: 'VALIDATION', errors };

            // 2. Check Global Shift Limit (Optimized: Read from shifts table)
            if (config.limit_total_shift) {
                const currentShiftTotal = (activeShift.total_sales || 0);
                
                // Note: The activeShift might be slightly stale if high concurrency, 
                // but we also rely on DB constraints or re-read in transaction?
                // For strict correctness inside transaction:
                const rsSync = await tx.execute({
                    sql: "SELECT total_sales FROM shifts WHERE id = ?",
                    args: [shift_id]
                });
                const syncTotal = rsSync.rows[0]?.total_sales || 0;

                if (syncTotal + totalBatchAmount > config.limit_total_shift) {
                    const available = config.limit_total_shift - syncTotal;
                    throw { 
                        type: 'GLOBAL_LIMIT', 
                        error: `Límite Global del Turno excedido. Disponible: ${available}`
                    };
                }
            }

            // 3. Check Per-Number Limits (Optimized: Read from shift_counters)
             const failedItems = [];
             for (const [number, requestedAmount] of Object.entries(batchTotals)) {
                  const rsNumStats = await tx.execute({
                      sql: "SELECT amount FROM shift_counters WHERE shift_id = ? AND number = ?",
                      args: [shift_id, number]
                  });
                  const currentTotal = (rsNumStats.rows[0]?.amount) || 0;
                  const available = config.limit_per_number - currentTotal;

                  if (requestedAmount > available) {
                      failedItems.push({ number, requested: requestedAmount, available: Math.max(0, available) });
                  }
             }

             if (failedItems.length > 0) throw { type: 'NUMBER_LIMIT', failedItems };

             // 4. Create Ticket ID (6 Digits)
             let ticketId = Math.floor(100000 + Math.random() * 900000).toString();

            const now = getBusinessDateTime();
            
            // Insert Ticket
            await tx.execute({
                sql: "INSERT INTO tickets (id, shift_id, total, created_at) VALUES (?, ?, ?, ?)",
                args: [ticketId, shift_id, totalBatchAmount, now]
            });

            // 5. Insert Sales & Update Counters
            for (const item of items) {
                 // Insert Sale
                 await tx.execute({
                     sql: "INSERT INTO sales (shift_id, ticket_id, number, amount, prize, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                     args: [shift_id, ticketId, item.number, item.amount, item.amount * 80, now]
                 });

                 // Update/Upsert Counter
                 await tx.execute({
                     sql: `INSERT INTO shift_counters (shift_id, number, amount, count) 
                           VALUES (?, ?, ?, 1) 
                           ON CONFLICT(shift_id, number) 
                           DO UPDATE SET amount = amount + ?, count = count + 1`,
                     args: [shift_id, item.number, item.amount, item.amount]
                 });
            }

            // Update Shift Totals
            await tx.execute({
                sql: "UPDATE shifts SET total_sales = total_sales + ?, ticket_count = ticket_count + 1 WHERE id = ?",
                args: [totalBatchAmount, shift_id]
            });

            await tx.commit();
            res.json({ success: true, count: items.length, ticketId });

        } catch (innerError) {
            await tx.rollback(); // Rollback implementation
            throw innerError;
        }

    } catch (e) {
        if (e.type === 'NUMBER_LIMIT') {
             return res.status(409).json({ error: "Límites excedidos", code: 'LIMIT_EXCEEDED', failedItems: e.failedItems });
        }
        if (e.type === 'GLOBAL_LIMIT') {
             return res.status(400).json({ error: e.error });
        }
        if (e.type === 'VALIDATION') {
             return res.status(400).json({ error: "Validation Error", details: e.errors });
        }
        res.status(500).json({ error: e.message });
    }
});

// Verify Ticket
router.get('/tickets/:id/verify', async (req, res) => {
    const { id } = req.params;
    try {
        const ticket = await dbGet("SELECT * FROM tickets WHERE id = ?", [id]);
        if (!ticket) return res.status(404).json({ error: "Ticket no encontrado" });

        const shift = await dbGet("SELECT * FROM shifts WHERE id = ?", [ticket.shift_id]);
        const sales = await dbAll("SELECT * FROM sales WHERE ticket_id = ?", [id]);

        let totalWon = 0;
        let status = 'PENDIENTE';
        let winningNumber = null;

        if (shift.status === 'FINALIZADO' || shift.status === 'CERRADO') {
             winningNumber = shift.winning_number;
             if (winningNumber) {
                 const winningSale = sales.find(s => s.number === winningNumber);
                 if (winningSale) {
                     totalWon = winningSale.prize;
                     status = 'GANADOR';
                 } else {
                     status = 'NO_PREMIADO';
                 }
             } else {
                 status = 'PENDIENTE_SORTEO';
             }
        }

        res.json({
            ticket,
            shift: { type: shift.type, date: shift.date, status: shift.status },
            sales,
            status,
            winningNumber,
            totalWon
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/tickets/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const ticket = await dbGet("SELECT * FROM tickets WHERE id = ?", [id]);
        if (!ticket) return res.status(404).json({ error: "Ticket no encontrado" });

        const shift = await dbGet("SELECT * FROM shifts WHERE id = ?", [ticket.shift_id]);
        if (shift && shift.status !== 'ABIERTO') {
            return res.status(400).json({ error: "No se puede anular un ticket de un turno cerrado." });
        }

        // Transaction for delete
        const tx = await db.transaction('write');
        try {
             await tx.execute({ sql: "DELETE FROM sales WHERE ticket_id = ?", args: [id] });
             await tx.execute({ sql: "DELETE FROM tickets WHERE id = ?", args: [id] });
             await tx.commit();
             res.json({ success: true, message: "Ticket anulado correctamente" });
        } catch (inner) {
             await tx.rollback();
             throw inner;
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Stats
router.get('/stats/clients', async (req, res) => {
    const { shift_id } = req.query;
    if (!shift_id) return res.json({ count: 0 });
    try {
        const result = await dbGet("SELECT COUNT(*) as count FROM tickets WHERE shift_id = ?", [shift_id]);
        res.json({ count: result.count });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/sales/recent', async (req, res) => {
    const { shift_id } = req.query;
    if (!shift_id) return res.json([]);
    try {
        const rows = await dbAll("SELECT * FROM sales WHERE shift_id = ? ORDER BY created_at DESC LIMIT 10", [shift_id]);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/sales/stats', async (req, res) => {
    const { shift_id } = req.query;
    if (!shift_id) return res.json({ total: 0, count: 0 });
    try {
        const stats = await dbGet("SELECT SUM(amount) as total, COUNT(*) as count FROM sales WHERE shift_id = ?", [shift_id]);
        res.json({ total: stats?.total || 0, count: stats?.count || 0 });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// History (Simplified)
router.get('/history/summary', async (req, res) => {
    try {
        const query = `
            SELECT 
                s.date,
                SUM(sa.amount) as total_sales,
                COUNT(sa.id) as total_tickets,
                GROUP_CONCAT(s.type || ':' || IFNULL(s.winning_number, '-')) as winners_summary
            FROM shifts s
            LEFT JOIN sales sa ON s.id = sa.shift_id
            GROUP BY s.date
            ORDER BY s.date DESC
            LIMIT 30
        `;
        const rows = await dbAll(query);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/history/:date', async (req, res) => {
    const { date } = req.params;
    try {
        const shifts = await dbAll(`
            SELECT s.*, 
                   (SELECT COUNT(*) FROM sales WHERE shift_id = s.id AND number = s.winning_number) as winner_count,
                   (SELECT SUM(prize) FROM sales WHERE shift_id = s.id AND number = s.winning_number) as total_payout,
                   (SELECT SUM(amount) FROM sales WHERE shift_id = s.id) as total_sold
            FROM shifts s 
            WHERE s.date = ?
        `, [date]);
        
        const total_sales = shifts.reduce((acc, s) => acc + (s.total_sold || 0), 0);
        const total_prizes = shifts.reduce((acc, s) => acc + (s.total_payout || 0), 0);

        res.json({ shifts, totals: { total_sales, total_prizes } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/sales/usage', async (req, res) => {
    const { shift_id } = req.query;
    if (!shift_id) return res.json({});
    try {
        // Optimized: Read from shift_counters instead of aggregation
        const usage = await dbAll("SELECT number, amount as total FROM shift_counters WHERE shift_id = ?", [shift_id]);
        const usageMap = {};
        usage.forEach(row => { usageMap[row.number] = row.total; });
        res.json(usageMap);
    } catch (e) {
         res.status(500).json({ error: e.message });
    }
});

module.exports = router;
