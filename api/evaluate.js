const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
  // Setup CORS to allow frontend fetch
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable in Vercel.");

    const { state, directive } = req.body;
    if (!state || !directive) throw new Error("Malformed request body. Missing 'state' or 'directive'.");

    const prompt = `
You are the cold, hyper-logical Central AI Physics & Sociology Engine for a space civilization simulator.
The Commander has just issued a new free-text DIRECTIVE.

=== CURRENT WORLD STATE ===
Population: ${state.population.toLocaleString()}
Food: ${state.food.toLocaleString()}
Technology Level: ${state.technology.toFixed(1)}
Pollution: ${state.pollution.toFixed(1)}/100
Economy Rating: ${state.economy.toFixed(1)}
Happiness: ${state.happiness.toFixed(1)}/100
Legitimacy: ${state.legitimacy.toFixed(1)}/100
Disease Rate: ${state.disease_rate.toFixed(1)}/100
Military Power: ${state.military.toFixed(1)}/100
Climate Damage: ${state.climate.toFixed(1)}/100

=== ISSUED DIRECTIVE ===
"${directive}"

Evaluate this directive logically. What are the realistic physics and sociology consequences?
Return ONLY a valid JSON object matching this schema exactly:
{
  "consequence": "<A vivid, immersive 2-sentence action report describing the outcome of the directive. Keep it cold, analytical, and aerospace-themed.>",
  "severity": "<OK|WARNING|CRITICAL>",
  "effects": {
    "food": <number positive or negative modifier (e.g., +20000)>,
    "happiness": <number modifier (e.g., -5, +5)>,
    "legitimacy": <number modifier>,
    "economy": <number modifier>,
    "pollution": <number modifier>,
    "military": <number modifier>
  }
}

Only return the keys inside "effects" that are meaningfully changed. Max modifier for 1-100 scales is generally +/- 15. Do not use markdown ticks.
    `.trim();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    
    let text = result.response.text().trim();
    if (text.startsWith("\`\`\`json")) text = text.substring(7, text.length - 3).trim();
    else if (text.startsWith("\`\`\`")) text = text.substring(3, text.length - 3).trim();
    
    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);

  } catch (error) {
    console.error("Gemini API Error (Evaluate):", error);
    return res.status(500).json({ error: error.message });
  }
};
