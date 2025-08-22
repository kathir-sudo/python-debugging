import express from 'express';
import path from 'path';

const app = express();

// Add ngrok skip header here
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

// Other middleware/routes
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.send('Server running with ngrok header');
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
