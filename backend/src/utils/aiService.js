import { GoogleGenAI } from "@google/genai";
import CircuitBreaker from 'opossum';

let ai = null;
function getAI() {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

const geminiBreakerOptions = {
  timeout: 3500, // 3.5s timeout: if LLM hangs, trip immediately
  errorThresholdPercentage: 50, // Trip open if >= 50% requests fail
  resetTimeout: 15000 // Test again after 15s
};

const geminiBreaker = new CircuitBreaker(async (prompt) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  const response = await getAI().models.generateContent({
    model: "gemini-flash-latest",
    contents: prompt,
    config: { temperature: 0.4, maxOutputTokens: 1024 }
  });
  if (!response?.text) {
    throw new Error('Empty response from Gemini LLM');
  }
  return response.text;
}, geminiBreakerOptions);

// Safe deterministic fallback when circuit trips open
geminiBreaker.fallback(() => null);

geminiBreaker.on('open', () => console.warn('[CircuitBreaker] Gemini breaker OPEN: external AI degraded, serving deterministic triage fallback.'));
geminiBreaker.on('halfOpen', () => console.info('[CircuitBreaker] Gemini breaker HALF-OPEN: probing external AI health.'));
geminiBreaker.on('close', () => console.info('[CircuitBreaker] Gemini breaker CLOSED: external AI healthy.'));

async function callGemini(prompt) {
  try {
    return await geminiBreaker.fire(prompt);
  } catch (err) {
    console.warn('[CircuitBreaker] Gemini call prevented by circuit breaker:', err.message);
    return null;
  }
}

export const FALLBACK_GUIDANCE = {
  medical: {
    steps: ['Ensure scene is safe.','Call 102 / 112 immediately.','Check responsiveness.','Begin CPR if unresponsive.','Use AED if available.'],
    emergencyScript: 'I have a medical emergency. A person is unresponsive at my location. I need an ambulance immediately.'
  },
  accident: {
    steps: ['Ensure scene safety and avoid oncoming traffic.','Call ambulance (108) and emergency services (112).','Do not move severely injured victims unless there is immediate danger.','Control visible bleeding with clean pressure.','Share exact location and number of injured people.'],
    emergencyScript: 'I am reporting a road accident at my location. Multiple injuries are possible. Please send an ambulance immediately.'
  },
  fire: {
    steps: ['Evacuate everyone immediately.','Call fire department (101).','Use stairs only.','Seal door gaps if trapped.','Use extinguisher only on small fires.'],
    emergencyScript: 'I am reporting a fire at my location. Please send the fire department immediately.'
  },
  crime: {
    steps: ['Move to safety.','Call police (100).','Note suspect details.','Preserve evidence.','Stay on line with dispatcher.'],
    emergencyScript: 'I am reporting a crime in progress. Please send police immediately.'
  },
  natural_disaster: {
    steps: ['Move to higher ground.','Call NDRF (011-24363260) or 112.','Stay away from damaged structures.','Keep emergency kit ready.','Follow evacuation orders.'],
    emergencyScript: 'I am reporting a natural disaster emergency. Immediate rescue assistance needed.'
  },
  other: {
    steps: ['Ensure your safety first.','Call 112.','Move to safe distance.','Warn others nearby.','Stay on line with dispatcher.'],
    emergencyScript: 'I am reporting an emergency at my location. I need immediate assistance.'
  }
};

export async function generateCrisisGuidance(crisisType, address) {
  const prompt = `You are an emergency first-response AI for India. A user triggered a ${crisisType} SOS${address ? ` near "${address}"` : ''}.
Return JSON only (no markdown):
{"steps":["step1","step2","step3","step4","step5"],"emergencyScript":"script"}
Steps should be concise first-response instructions. Include Indian emergency numbers (100,101,102,108).`;

  const raw = await callGemini(prompt);
  if (!raw) return FALLBACK_GUIDANCE[crisisType] || FALLBACK_GUIDANCE.other;
  try {
    const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.steps) && typeof parsed.emergencyScript === 'string') return parsed;
  } catch {}
  return FALLBACK_GUIDANCE[crisisType] || FALLBACK_GUIDANCE.other;
}

export async function generateEmergencySummary(crisisType, address, radiusMeters) {
  const prompt = `Write a concise 2-sentence emergency summary for a dispatcher in India. Crisis: ${crisisType}. Location: ${address || 'coordinates shared'}. Radius: ${radiusMeters}m. Return only the summary text.`;
  const raw = await callGemini(prompt);
  if (raw) return raw.trim();
  return `${crisisType.toUpperCase()} emergency at ${address || 'shared location'}. Nearby responders requested within ${radiusMeters} meters.`;
}

export async function generateDebriefPrompt(crisisType, durationSeconds, responderCount) {
  const minutes = Math.round((durationSeconds || 0) / 60);
  const prompt = `A ${crisisType} emergency resolved after ${minutes} minutes with ${responderCount || 0} responders. Write a 3-4 sentence debrief: acknowledge resolution, suggest professional follow-up, encourage rating responders, thank user. Return only the text.`;
  const raw = await callGemini(prompt);
  if (raw) return raw.trim();
  return `Your ${crisisType} emergency has been resolved after ${minutes} minutes. Please follow up with professional services if needed. Rate your responders to help the community. Thank you for using RakshaSetu.`;
}

export async function askCrisisAssistant(crisisType, question, conversationHistory = []) {
  const historyText = conversationHistory.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
  const prompt = `You are RakshaSetu AI, an emergency crisis assistant for India. User is in a ${crisisType} emergency.
Previous conversation:\n${historyText || '(none)'}
User: ${question}
Provide concise, actionable safety advice under 150 words. Mention Indian emergency numbers if relevant (100,101,102,108,112).`;
  const raw = await callGemini(prompt);
  if (raw) return raw.trim();
  return `For ${crisisType} emergencies, call 112 immediately. Stay calm and ensure your safety first.`;
}
