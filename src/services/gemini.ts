import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function identifyItem(base64Image: string): Promise<string> {
  if (!process.env.GEMINI_API_KEY) return "New Item";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: "Identify this grocery or household item in 1-3 words. Only return the name." },
            { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] || base64Image } }
          ]
        }
      ],
    });
    
    return response.text?.trim() || "New Item";
  } catch (error) {
    console.error("AI identification failed:", error);
    return "New Item";
  }
}
