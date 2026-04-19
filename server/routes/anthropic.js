import { Router } from 'express';

const router = Router();

router.post('/messages', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Anthropic error:', response.status, JSON.stringify(data));
    }
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[anthropic proxy]', err);
    res.status(500).json({ error: 'Anthropic proxy error' });
  }
});

export default router;
