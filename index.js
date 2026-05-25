import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',')
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '1mb' }));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are Tathastu AI Counselor — the official virtual assistant for Tathastu ICS (Institute of Civil Services), founded by Dr. Tanu Jain, Ex-Civil Servant.

INSTITUTE FACTS:
- Tagline: India's Premium UPSC Mentorship Platform
- YouTube: 1.36M+ subscribers, 185M+ views, 3800+ videos
- Website: https://tathastuics.com

COURSES: UPSC+BA, BBA BankReg, GS Foundation, Philosophy Optional, Anthropology Optional, PSIR Optional, Interview Guidance Programme. All include mentorship.

OFFICES:
- Delhi: Plot No.B 22, Bada Bazar Road, Old Rajinder Nagar, New Delhi-110060
- Greater Noida: Plot No 41, Knowledge Park I, Greater Noida, UP-201310 (near Pari Chowk Metro)

CONTACT: Phone 9560300770, 8010000433 | Email enquiry@tathastuics.com

SOCIAL: YouTube @Tathastuics, Instagram tathastuics, Telegram t.me/tathastubyTanuJain

GUIDELINES:
- Be professional, warm, concise (2-4 short paragraphs max).
- Reply in English or Hindi based on user's language.
- For exact fees/schedules/batch dates, ask them to call 9560300770 or fill the contact form.
- Never invent statistics or guarantees beyond facts above.
- Encourage serious aspirants; mention Dr. Tanu Jain's civil service experience when relevant.`;

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, groq: Boolean(process.env.GROQ_API_KEY) });
});

// AI Chat
app.post('/api/chat', async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        error: 'AI service not configured. Please add GROQ_API_KEY to .env',
      });
    }

    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const sanitized = messages
      .filter((m) => m?.role && m?.content)
      .slice(-20)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content).slice(0, 4000),
      }));

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...sanitized],
      max_tokens: 1024,
      temperature: 0.65,
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(502).json({ error: 'Empty response from AI' });
    }

    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err?.message || err);
    res.status(500).json({
      error: err?.message?.includes('API key')
        ? 'Invalid Groq API key'
        : 'Unable to process your message. Try again or WhatsApp us at 9560300770.',
    });
  }
});

app.listen(PORT, () => {
  console.log('\n🚀 Tathastu API');
  console.log(`   URL     : http://localhost:${PORT}`);
  console.log(`   Health  : http://localhost:${PORT}/api/health`);
  console.log(`   Groq    : ${process.env.GROQ_API_KEY ? '✅ Connected' : '❌ Missing GROQ_API_KEY'}`);
  console.log(`   CORS    : ${allowedOrigins.join(', ')}`);
  console.log('   Status  : Ready\n');
});
