import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Import della funzione translate
import translate from './api/translate.js';

// Route principale per la traduzione
app.post('/api/translate', translate);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Figma Translation Proxy is running!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
