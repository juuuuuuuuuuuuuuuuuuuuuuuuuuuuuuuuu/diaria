const db = require('better-sqlite3')('pos.db');

console.log('--- SHIFTS ---');
const shifts = db.prepare('SELECT * FROM shifts').all();
console.table(shifts);

console.log('--- SALES (Limit 10) ---');
const sales = db.prepare('SELECT * FROM sales LIMIT 10').all();
console.table(sales);

console.log('--- HISTORY SUMMARY QUERY TEST ---');
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
const summary = db.prepare(query).all();
console.table(summary);
