import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors()); // Enable CORS for all routes

// Proxy endpoint
app.get('/proxy', async (req, res) => {
  const { url } = req.query; // Get the URL to proxy from the query parameter
  if (!url) {
    return res.status(400).send('Missing URL parameter');
  }

  const allowedDomains = ['boardgamegeek.com'];
  const urlObj = new URL(url);
  if (!allowedDomains.includes(urlObj.hostname)) {
    return res.status(400).send('Invalid URL');
  }

  try {
    const response = await fetch(url);
    const data = await response.text();
    res.send(data); // Send the response back to the client
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Error fetching data');
  }
});

// Start the server
const PORT = 3000; // You can change the port if needed
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});