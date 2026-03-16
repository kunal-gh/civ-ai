const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
  // Setup CORS to allow frontend fetch
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable in Vercel.");
    }

    const { state } = req.body;
    if (!state) {
        throw new Error("Malformed request body. Missing 'state'.");
    }
    
    const prompt = `
You are the Event Director for a civilization simulation game called AXIOM.
Current civilization state variables:
Population: ${state.population.toLocaleString()}
Food: ${state.food.toLocaleString()}
Technology Level: ${state.technology.toFixed(1)}
Pollution: ${state.pollution.toFixed(1)}/100
Economy Rating: ${state.economy.toFixed(1)}
Happiness: ${state.happiness.toFixed(1)}/100
Legitimacy (Gov Trust): ${state.legitimacy.toFixed(1)}/100
Disease Rate: ${state.disease_rate.toFixed(1)}/100
Military Power: ${state.military.toFixed(1)}/100
Climate Damage: ${state.climate.toFixed(1)}/100

Generate ONE realistic global event taking these EXACT metrics into consideration. Focus on the most extreme or alarming variables (e.g. high pollution, low happiness, incredible economy).

Return ONLY a valid JSON object matching this schema exactly:
{
  "event": "<A vivid, immersive 2-sentence news brief describing the event>",
  "severity": "<minor|moderate|major|catastrophic>",
  "effects": {
    "food": <number positive or negative modifier>,
    "happiness": <number modifier>,
    "legitimacy": <number modifier>,
    "population": <number modifier>
  }
}
Do not use markdown ticks around the output, strictly return valid JSON.
    `.trim();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    
    let text = result.response.text().trim();
    // Clean markdown blocks if present
    if (text.startsWith("```json")) {
        text = text.substring(7, text.length - 3).trim();
    } else if (text.startsWith("```")) {
        text = text.substring(3, text.length - 3).trim();
    }
    
    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);

  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: error.message });
  }
};
