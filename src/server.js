require('dotenv').config({ quiet: true });
const app = require('./app');

const puerto = Number(process.env.PORT) || 3000;
app.listen(puerto, () => console.log(`Kova Fit en http://localhost:${puerto}`));