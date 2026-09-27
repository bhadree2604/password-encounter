const express = require('express');
const crypto = require('crypto');
const path = require('path');

const PORT = process.env.PORT || 3000;

const secretAnswers={round1:process.env.ANSWER_R1||'penelope',round2:process.env.ANSWER_R2||'penelope',round3:process.env.ANSWER_R3||'i am home'};

function normalizeInput(str){return String(str||'').trim().toLowerCase();}

function hashValue(str){return crypto.createHash('sha256').update(normalizeInput(str),'utf8').digest('hex');}

function constantTimeCompare(a,b){const bufA=Buffer.from(String(a),'hex');const bufB=Buffer.from(String(b),'hex');if(bufA.length!==bufB.length||bufA.length===0)return false;return crypto.timingSafeEqual(bufA,bufB);}

const attemptTracker=new Map();
function rateLimitMiddleware(req,res,next){const timestamp=Date.now();const clientIP=req.ip||req.socket.remoteAddress||'unknown';const recentAttempts=(attemptTracker.get(clientIP)||[]).filter(time=>timestamp-time<60000);if(recentAttempts.length>=20){return res.status(429).json({success:false,message:'Too many tries — wait a bit.'});}recentAttempts.push(timestamp);attemptTracker.set(clientIP,recentAttempts);next();}

const app = express();
app.use(express.json({ limit: '4kb' }));

app.post('/api/check',rateLimitMiddleware,(req,res)=>{const roundNumber=Number(req.body&&req.body.round);const userAttempt=req.body&&req.body.attempt;if(![1,2,3].includes(roundNumber)||typeof userAttempt!=='string'||userAttempt.length>200){return res.status(400).json({success:false});}let answerKey='round1';if(roundNumber===2)answerKey='round2';else if(roundNumber===3)answerKey='round3';const correctAnswer=secretAnswers[answerKey];let isCorrect=false;try{const attemptHash=hashValue(userAttempt);const correctHash=hashValue(correctAnswer);isCorrect=constantTimeCompare(attemptHash,correctHash);}catch(err){isCorrect=false;}setTimeout(()=>res.json({success:isCorrect}),120);});

// Serve the game (frontend/index.html, frontend/odyssey-bg.png).
const frontendPath = path.join(__dirname, '..', 'frontend');
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});
app.use(express.static(frontendPath));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('Password Encounter on http://localhost:' + PORT);
  });
}

module.exports = app;
