const express = require('express');
const router = express.Router();
const db = require('./database');
const { format } = require('date-fns');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, SECRET_KEY } = require('./middleware/auth');

// --- HELPERS ---
const getActiveShift = () => {
    return db.prepare("SELECT * FROM shifts WHERE status = 'ABIERTO'").get();
};

const getConfig = () => {
    return db.prepare("SELECT * FROM config WHERE id = 1").get();
};

// --- ROUTES ---

// 0. AUTHENTICATION
router.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    // Check user
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    // Check password
    if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // Generate Token
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '12h' });
    
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// Users Management (Protected)
router.get('/users', authenticateToken, (req, res) => {
    // Only allow listing users if authenticated
    const users = db.prepare("SELECT id, username, role, created_at FROM users").all();
    res.json(users);
});

router.post('/users', authenticateToken, (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Datos incompletos" });

    try {
        const hash = bcrypt.hashSync(password, 10);
        const stmt = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
        const info = stmt.run(username, hash);
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
        res.status(400).json({ error: "El usuario ya existe o error en base de datos." });
    }
});

router.put('/users/:id/password', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    
    try {
        const hash = bcrypt.hashSync(password, 10);
        db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hash, id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/users/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    // Prevent deleting self? Frontend can handle logic, backend just ensures validity
    if (req.user.id == id) return res.status(400).json({ error: "No puedes eliminar tu propio usuario." });

    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    res.json({ success: true });
});


// 1. CONFIG
router.get('/config', (req, res) => {
    try {
        const config = getConfig();
        config.shift_schedule = JSON.parse(config.shift_schedule);
        res.json(config);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/config', (req, res) => {
    const { limit_per_number, limit_total_shift, system_retention, shift_schedule, whatsapp_number } = req.body;
    try {
        const stmt = db.prepare(`
            UPDATE config SET 
            limit_per_number = @limit,
            limit_total_shift = @limitTotal,
            system_retention = @retention,
            shift_schedule = @schedule,
            whatsapp_number = @whatsapp
            WHERE id = 1
        `);
        stmt.run({
            limit: limit_per_number,
            limitTotal: limit_total_shift,
            retention: system_retention,
            schedule: JSON.stringify(shift_schedule),
            whatsapp: whatsapp_number
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. SHIFTS
router.get('/shifts/day-status', (req, res) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const shifts = db.prepare("SELECT type, status, id FROM shifts WHERE date = ?").all(today);
    
    // Default structure
    const status = {
        'Mañana': null,
        'Tarde': null,
        'Noche': null
    };

    shifts.forEach(s => {
        status[s.type] = s;
    });

    res.json({ date: today, shifts: status });
});

router.get('/shifts/current', (req, res) => {
    // Legacy support: returns the latest open shift or null
    const shift = db.prepare("SELECT * FROM shifts WHERE status = 'ABIERTO' ORDER BY id DESC LIMIT 1").get();
    res.json(shift || null);
});

router.post('/shifts/open', (req, res) => {
    const { type } = req.body; // 'Mañana', 'Tarde', 'Noche'
    const today = format(new Date(), 'yyyy-MM-dd');

    // Check availability of THIS shift type
    const existing = db.prepare("SELECT * FROM shifts WHERE date = ? AND type = ?").get(today, type);
    
    if (existing) {
        if (existing.status === 'ABIERTO') {
            return res.json({ success: true, id: existing.id, resumed: true });
        } else {
            return res.status(400).json({ error: `El turno de la ${type} ya está ${existing.status}.` });
        }
    }

    // Check max shifts per day (Limit 3)
    const shiftsToday = db.prepare("SELECT COUNT(*) as count FROM shifts WHERE date = ?").get(today);
    if (shiftsToday.count >= 3) {
        return res.status(400).json({ error: "Límite de turnos diarios (3) alcanzado." });
    }

    // Open new shift
    try {
        const stmt = db.prepare("INSERT INTO shifts (type, date, status) VALUES (?, ?, 'ABIERTO')");
        const info = stmt.run(type, today);
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/shifts/close', (req, res) => {
    const { shift_id, winning_number } = req.body;

    if (!shift_id) return res.status(400).json({ error: "Shift ID Required" });

    // If winning number provided, finalize directly. Else just close.
    let status = 'CERRADO';
    if (winning_number) status = 'FINALIZADO';

    const stmt = db.prepare("UPDATE shifts SET status = ?, winning_number = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?");
    stmt.run(status, winning_number || null, shift_id);
    
    res.json({ success: true });
});

router.get('/shifts/:id/simulate-winner', (req, res) => {
    const { id } = req.params;
    const { number } = req.query;

    if (!number) return res.json({ winner_count: 0, total_prizes: 0, total_sold: 0 });

    const stats = db.prepare(`
        SELECT 
            COUNT(*) as winner_count,
            SUM(prize) as total_prizes,
            (SELECT SUM(amount) FROM sales WHERE shift_id = ? AND number = ?) as total_sold
        FROM sales 
        WHERE shift_id = ? AND number = ?
    `).get(id, number, id, number);

    res.json({
        winner_count: stats.winner_count || 0,
        total_prizes: stats.total_prizes || 0,
        total_sold: stats.total_sold || 0
    });
});

router.put('/shifts/:id/winner', (req, res) => {
    const { id } = req.params;
    const { number } = req.body;
    
    if (!number || number.length !== 2) return res.status(400).json({ error: "Número inválido" });

    const stmt = db.prepare("UPDATE shifts SET winning_number = ?, status = 'FINALIZADO' WHERE id = ?");
    const info = stmt.run(number, id);
    
    if (info.changes === 0) return res.status(404).json({ error: "Turno no encontrado" });
    
    res.json({ success: true });
});

router.get('/shifts/:id/report', (req, res) => {
    const { id } = req.params;
    // Get total sales per number
    const sales = db.prepare(`
        SELECT number, SUM(amount) as total_amount 
        FROM sales 
        WHERE shift_id = ? 
        GROUP BY number
    `).all(id);

    const shift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(id);
    
    // Calculate totals
    const totalSold = sales.reduce((acc, curr) => acc + curr.total_amount, 0);

    res.json({ shift, sales, totalSold });
});


// 3. SALES
router.post('/sales/bulk', (req, res) => {
    const { items, shift_id } = req.body;
    
    if (!shift_id) return res.status(400).json({ error: "Shift ID Required" });
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "No items provided" });

    const activeShift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(shift_id);
    if (!activeShift || activeShift.status !== 'ABIERTO') {
        return res.status(400).json({ error: "El turno no está abierto." });
    }

    const config = getConfig();
    const transaction = db.transaction(() => {
        const errors = [];
        let totalBatchAmount = 0;

        // 1. Pre-calculate batch totals per number to handle duplicate numbers in same cart
        const batchTotals = {}; // { '05': 100, '10': 20 }
        
        for (const item of items) {
             if (item.amount % 5 !== 0) {
                 errors.push({ number: item.number, error: "Múltiplo de 5 requerido" });
                 continue;
             }
             batchTotals[item.number] = (batchTotals[item.number] || 0) + item.amount;
             totalBatchAmount += item.amount;
        }

        if (errors.length > 0) return { success: false, errors, type: 'VALIDATION' };

        // 2. Check Global Shift Limit
        if (config.limit_total_shift) {
            const shiftStats = db.prepare("SELECT SUM(amount) as total FROM sales WHERE shift_id = ?").get(shift_id);
            const currentShiftTotal = shiftStats.total || 0;
            
            if (currentShiftTotal + totalBatchAmount > config.limit_total_shift) {
                 const available = config.limit_total_shift - currentShiftTotal;
                 return { 
                    success: false, 
                    type: 'GLOBAL_LIMIT', 
                    available, 
                    requested: totalBatchAmount,
                    error: `Límite Global del Turno excedido. Disponible: ${available}`
                 };
            }
        }

        // 3. Check Per-Number Limits
        const failedItems = [];
        
        for (const [number, requestedAmount] of Object.entries(batchTotals)) {
             const currentStats = db.prepare("SELECT SUM(amount) as total FROM sales WHERE shift_id = ? AND number = ?").get(shift_id, number);
             const currentTotal = currentStats.total || 0;
             const available = config.limit_per_number - currentTotal;

             if (requestedAmount > available) {
                 failedItems.push({
                     number,
                     requested: requestedAmount,
                     available: available > 0 ? available : 0
                 });
             }
        }

        if (failedItems.length > 0) {
            return { success: false, type: 'NUMBER_LIMIT', failedItems };
        }

        // 4. Create Ticket & Insert Sales
        let ticketId;
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 5) {
             const random = Math.floor(1000 + Math.random() * 9000); // 4 digits
             const time = Date.now().toString().slice(-4); // last 4 digits of timestamp
             const candidateId = `T-${random}-${time}`;
             
             // Check existence
             const exists = db.prepare("SELECT 1 FROM tickets WHERE id = ?").get(candidateId);
             if (!exists) {
                 ticketId = candidateId;
                 isUnique = true;
             }
             attempts++;
        }

        if (!isUnique) {
            // Fallback to a safer but longer ID if collision persists (unlikely)
            ticketId = `T-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        }
        
        // Insert Ticket
        db.prepare("INSERT INTO tickets (id, shift_id, total) VALUES (?, ?, ?)").run(ticketId, shift_id, totalBatchAmount);

        // Insert Sales
        const stmt = db.prepare("INSERT INTO sales (shift_id, ticket_id, number, amount, prize) VALUES (?, ?, ?, ?, ?)");
        for (const item of items) {
            stmt.run(shift_id, ticketId, item.number, item.amount, item.amount * 80);
        }

        return { success: true, ticketId };
    });

    try {
        const result = transaction();
        if (!result.success) {
            if (result.type === 'NUMBER_LIMIT') {
                return res.status(409).json({ 
                    error: "Límites excedidos", 
                    code: 'LIMIT_EXCEEDED', 
                    failedItems: result.failedItems 
                });
            }
            if (result.type === 'GLOBAL_LIMIT') {
                return res.status(400).json({ error: result.error });
            }
            return res.status(400).json({ error: "Validation Error", details: result.errors });
        }
        res.json({ success: true, count: items.length, ticketId: result.ticketId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Verify Ticket Endpoint
router.get('/tickets/:id/verify', (req, res) => {
    const { id } = req.params;
    
    const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(id);
    if (!ticket) return res.status(404).json({ error: "Ticket no encontrado" });

    const shift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(ticket.shift_id);
    const sales = db.prepare("SELECT * FROM sales WHERE ticket_id = ?").all(id);
    
    let totalWon = 0;
    let status = 'PENDIENTE'; // PENDIENTE, GANADOR, NO_PREMIADO
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
             status = 'PENDIENTE_SORTEO'; // Closed but no number yet? Should not happen usually if finalized
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
});

// Delete Ticket Endpoint
router.delete('/tickets/:id', (req, res) => {
    const { id } = req.params;

    const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(id);
    if (!ticket) return res.status(404).json({ error: "Ticket no encontrado" });

    const shift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(ticket.shift_id);
    
    // Safety check: Only allow deletion if shift is OPEN
    if (shift && shift.status !== 'ABIERTO') {
        return res.status(400).json({ error: "No se puede anular un ticket de un turno cerrado." });
    }

    const deleteTransaction = db.transaction(() => {
        // Delete sales first (FK)
        db.prepare("DELETE FROM sales WHERE ticket_id = ?").run(id);
        // Delete ticket
        const result = db.prepare("DELETE FROM tickets WHERE id = ?").run(id);
        return result;
    });

    try {
        deleteTransaction();
        res.json({ success: true, message: "Ticket anulado correctamente" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Real Clients Count (Distinct Tickets)
router.get('/stats/clients', (req, res) => {
    const { shift_id } = req.query;
    if (!shift_id) return res.json({ count: 0 });

    const result = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE shift_id = ?").get(shift_id);
    res.json({ count: result.count });
});

router.post('/sales', (req, res) => {
    // Transaction for atomic check and write
    const { number, amount, shift_id } = req.body;
    
    if (!shift_id) return res.status(400).json({ error: "Shift ID Required" });

    // Validation 1: Multiples of 5
    if (amount % 5 !== 0) {
        return res.status(400).json({ error: "El monto debe ser múltiplo de 5." });
    }

    const config = getConfig();

    const insert = db.transaction(() => {
        // Validation 2: Limit per number
        const currentSales = db.prepare("SELECT SUM(amount) as total FROM sales WHERE shift_id = ? AND number = ?").get(shift_id, number);
        const currentTotal = currentSales.total || 0;

        if (currentTotal + amount > config.limit_per_number) {
            const remaining = config.limit_per_number - currentTotal;
            throw new Error(`Límite excedido para el ${number}. Disponible: ${remaining}`);
        }

        // Validation 3: Limit Total per Shift
        if (config.limit_total_shift) {
            const shiftTotal = db.prepare("SELECT SUM(amount) as total FROM sales WHERE shift_id = ?").get(shift_id).total || 0;
            if (shiftTotal + amount > config.limit_total_shift) {
                 const remaining = config.limit_total_shift - shiftTotal;
                 throw new Error(`Límite GLOBAL del turno excedido. Disponible: ${remaining}`);
            }
        }

        const prize = amount * 80;
        db.prepare("INSERT INTO sales (shift_id, number, amount, prize) VALUES (?, ?, ?, ?)").run(shift_id, number, amount, prize);
        
        return { success: true, prize, remaining: config.limit_per_number - (currentTotal + amount) };
    });

    try {
        const result = insert();
        res.json(result);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.get('/sales/recent', (req, res) => {
    const { shift_id } = req.query;
    if (!shift_id) return res.json([]);
    
    const rows = db.prepare("SELECT * FROM sales WHERE shift_id = ? ORDER BY created_at DESC LIMIT 10").all(shift_id);
    res.json(rows);
});

router.get('/sales/stats', (req, res) => {
    const { shift_id } = req.query;
    if (!shift_id) return res.json({ total: 0, count: 0 });

    const stats = db.prepare("SELECT SUM(amount) as total, COUNT(*) as count FROM sales WHERE shift_id = ?").get(shift_id);
    res.json(stats);
});

// 4. HISTORY & REPORTS

router.get('/history/summary', (req, res) => {
    const { date } = req.query; // Optional filter

    let query = `
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
    
    // Simplification: Return list of dates and aggregate totals
    const rows = db.prepare(query).all();
    res.json(rows);
});

router.get('/history/:date', (req, res) => {
    const { date } = req.params;
    
    // 1. Shift details with aggregated stats per shift
    const shifts = db.prepare(`
        SELECT s.*, 
               (SELECT COUNT(*) FROM sales WHERE shift_id = s.id AND number = s.winning_number) as winner_count,
               (SELECT SUM(prize) FROM sales WHERE shift_id = s.id AND number = s.winning_number) as total_payout,
               (SELECT SUM(amount) FROM sales WHERE shift_id = s.id) as total_sold
        FROM shifts s 
        WHERE s.date = ?
    `).all(date);

    // 2. Daily Totals
    // Calculate totals from the shifts data directly to ensure consistency
    const total_sales = shifts.reduce((acc, s) => acc + (s.total_sold || 0), 0);
    const total_prizes = shifts.reduce((acc, s) => acc + (s.total_payout || 0), 0);

    res.json({ 
        shifts, 
        totals: { 
            total_sales, 
            total_prizes 
        } 
    });
});

// 5. SALES LIMITS USAGE
router.get('/sales/usage', (req, res) => {
    const { shift_id } = req.query;
    if (!shift_id) return res.json({});
    
    // Get aggregated sales per number for this shift
    const usage = db.prepare("SELECT number, SUM(amount) as total FROM sales WHERE shift_id = ? GROUP BY number").all(shift_id);
    
    // Convert to map { "00": 100, "01": 50 }
    const usageMap = {};
    usage.forEach(row => {
        usageMap[row.number] = row.total;
    });
    
    res.json(usageMap);
});

module.exports = router;
