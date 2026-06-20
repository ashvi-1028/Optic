import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/analyze', (req, res) => {
  const imageUrl = req.body?.imageUrl || '';
  const text = req.body?.text || '';
  const flags = [];

  if (/starbucks/i.test(imageUrl) || /starbucks/i.test(text)) {
    flags.push({ type: 'local_business', value: 'Starbucks' });
  }
  if (/clock|time|watch|13:|14:|15:/i.test(text)) {
    flags.push({ type: 'time', value: 'visible_time' });
  }
  if (/nails|manicure/i.test(text)) {
    flags.push({ type: 'personal_item', value: 'nails' });
  }

  res.json({ flags, analysis: 'mock', debug: { imageUrl, text } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Mock image-analysis server listening on port ${PORT}`));
