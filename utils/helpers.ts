
import { GoogleGenAI } from "@google/genai";
import { getEnv } from "./env";

export const getMonday = (d: Date | string) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
  return new Date(date.setDate(diff));
};

export const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0];
};

export const getDaysOfWeek = (startDetails: Date) => {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDetails);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
};

export const getWeeksForMonth = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const weeks = new Set<string>();
  const current = new Date(firstDay);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  current.setDate(diff);

  while (current <= lastDay || (current > lastDay && current.getDate() < 8)) {
     const weekEnd = new Date(current);
     weekEnd.setDate(weekEnd.getDate() + 6);
     if (weekEnd >= firstDay || current <= lastDay) {
        weeks.add(formatDate(current));
     }
     current.setDate(current.getDate() + 7);
  }
  return Array.from(weeks);
};

export const getYTPYearAndWeek = (dateStr: string) => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  
  // Logic from AnnualPlan to match grid start date (Monday of week containing Jan 1)
  const d = new Date(year, 0, 1); 
  const day = d.getDay(); 
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  const start = new Date(d.setDate(diff)); 

  // Check if date is actually before the start monday (rare edge case for very early Jan dates falling into prev year ISO week)
  // For simplicity, we stick to the year of the event
  const diffTime = date.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
  
  let week = Math.floor(diffDays / 7) + 1;
  
  if (week < 1) week = 1; 
  if (week > 52) week = 52; // Clamp for display

  return { year, week };
};

// Fix: Use @google/genai SDK for Gemini API calls
export const callGemini = async (prompt: string): Promise<string> => {
  // Use getEnv to safely access the API key from multiple sources
  const apiKey = getEnv('API_KEY');

  // Fallback if no valid key provided
  if (!apiKey || apiKey.includes("DummyKey") || apiKey === "YOUR_API_KEY" || apiKey.includes("AIzaSy...")) {
      console.warn("Gemini API Key missing or invalid. Using demo response.");
      return "Plan: 1. Focus on footwork drills. 2. Increase smash power with resistance training. 3. Analyze opponent weakness in backhand corner. (Demo Mode: AI response simulated)";
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    // Use gemini-3-flash-preview for basic text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    return response.text || "Could not generate content.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to connect to AI service. Please check your API key.";
  }
};
