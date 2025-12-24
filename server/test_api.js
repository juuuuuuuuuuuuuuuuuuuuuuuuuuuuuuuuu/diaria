const http = require('http');

const get = (path) => {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3001/api${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
};

(async () => {
    try {
        console.log('--- SUMMARY ---');
        const summary = await get('/history/summary');
        console.log(summary);
        
        console.log('\n--- DETAILS for 2025-12-19 ---');
        const details = await get('/history/2025-12-19');
        console.log(details.substring(0, 500) + '...'); // Truncate
    } catch (e) {
        console.error(e);
    }
})();
