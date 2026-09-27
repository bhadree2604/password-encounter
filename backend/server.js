const express = require('express');
const crypto = require('crypto');
const path = require('path');

const PORT = process.env.PORT || 3000;

// SHA-256 (hex) of the normalized answers — never the answers themselves.
// Override with env vars to keep even the digests out of the repo.
const HASH_R1 = process.env.HASH_R1 || 'ac7a89c282194aa6fd19ee0916325e2e5a7ccb0635056a2dcbcb084bc1f71fd8';
const HASH_R3 = process.env.HASH_R3 || 'caf9b632973835e0831ab8f782dce9ed92d12504b61b8c075c538594373bbcf9';

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

function digest(s) {
  return crypto.createHash('sha256').update(norm(s), 'utf8').digest('hex');
}

function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'hex');
  const bb = Buffer.from(String(b), 'hex');
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Simple in-memory rate limit for the verify endpoint: 20 tries / minute / IP.
const hits = new Map();
function verifyLimiter(req, res, next) {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (arr.length >= 20) {
    return res.status(429).json({ ok: false, error: 'Too many tries — wait a bit.' });
  }
  arr.push(now);
  hits.set(ip, arr);
  next();
}

const app = express();
app.use(express.json({ limit: '4kb' }));

app.post('/api/verify', verifyLimiter, (req, res) => {
  const round = Number(req.body && req.body.round);
  const guess = req.body && req.body.guess;
  if (![1, 2, 3].includes(round) || typeof guess !== 'string' || guess.length > 200) {
    return res.status(400).json({ ok: false });
  }
  const expected = round === 3 ? HASH_R3 : HASH_R1;
  let ok = false;
  try {
    ok = safeEqualHex(digest(guess), expected);
  } catch (e) {
    ok = false;
  }
  // Tiny fixed delay blunts timing probes; never reveal which part was wrong.
  setTimeout(() => res.json({ ok }), 120);
});

// Serve the game (frontend/password-encounter.html, frontend/odyssey-bg.png).
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.listen(PORT, () => {
  console.log('Password Encounter on http://localhost:' + PORT + '/password-encounter.html');
});
