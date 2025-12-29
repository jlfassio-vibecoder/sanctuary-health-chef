import { GoogleGenAI, Type, Schema } from "@google/genai";
import JSON5 from 'json5';
import { UserProfile, DailyContext, TrainerType, Recipe } from "../types";

const STORAGE_KEY = 'GEMINI_API_KEY';

// Get API key from environment or localStorage
const getDefaultKey = () => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_GEMINI_API_KEY;
    }
  } catch (e) { /* ignore */ }
  return '';
};

let currentApiKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) || getDefaultKey() : getDefaultKey();

export const updateGeminiApiKey = (key: string) => {
  currentApiKey = key;
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, key);
};

export const getGeminiApiKey = () => currentApiKey;

// NEW: Clean Recipe Schema for Gemini
const recipeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Name of the Dish" },
    description: { type: Type.STRING, description: "Appetizing description" },
    difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
    chefNote: { type: Type.STRING, description: "Personal tip from the chef" },
    totalTime: { type: Type.NUMBER, description: "Total minutes" },
    calories: { type: Type.NUMBER, description: "Calories per serving" },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["Overview", "Ingredients", "Instructions"] },
          title: { type: Type.STRING },
          items: { type: Type.ARRAY, items: { type: Type.STRING } },
          ingredients: {
              type: Type.ARRAY,
              items: {
                  type: Type.OBJECT,
                  properties: {
                      item: { type: Type.STRING },
                      quantity: { type: Type.STRING },
                      unit: { type: Type.STRING },
                      prep: { type: Type.STRING }
                  },
                  required: ["item", "quantity", "unit", "prep"]
              }
          },
          metadata: {
              type: Type.OBJECT,
              properties: {
                  timer: { type: Type.STRING },
                  technique: { type: Type.STRING },
                  quantity: { type: Type.STRING }
              }
          }
        },
        required: ["type", "title", "items"]
      }
    }
  },
  required: ["title", "sections", "totalTime", "calories"]
};

export const generateRecipe = async (
  profile: UserProfile,
  daily: DailyContext,
  chefType: TrainerType
): Promise<Recipe> => {
  
  const ai = new GoogleGenAI({ apiKey: currentApiKey });
  const unitLabel = profile.units.system;
  
  // Check for imported workout context passed via equipmentAvailable hack or cravings
  const workoutContext = daily.equipmentAvailable?.find(e => e.includes("Recovery Meal for:"));

  const systemInstruction = `
    You are an expert Private Chef called "${chefType}".
    Generate a delicious, healthy, tailored recipe.
    
    RULES:
    - Respect Allergies: ${profile.injuries.join(', ') || 'None'}.
    - Use ${unitLabel} measurements.
    - Return valid JSON matching the schema.
    
    STRUCTURE:
    1. Section 1 (Overview): items=["Prep: X min", "Cook: Y min", "Serves: Z"]
    2. Section 2 (Ingredients): title="Mise en Place", items=[Legacy list...], ingredients=[{item:"Chicken", quantity:"2", unit:"lbs", prep:"diced"}]
    3. Section 3+ (Instructions): title="Step 1:...", items=[Detailed instruction], metadata={timer:"X mins"}
    
    EXAMPLE JSON:
    {
      "title": "Lemon Chicken",
      "description": "Zesty and fresh.",
      "difficulty": "Easy",
      "chefNote": "Don't overcook!",
      "totalTime": 30,
      "calories": 400,
      "sections": [
        { "type": "Overview", "title": "Info", "items": ["Prep: 10m", "Cook: 20m", "Serves: 2"] },
        { 
            "type": "Ingredients", 
            "title": "Mise en Place", 
            "items": ["2 Chicken Breasts", "1 Lemon"],
            "ingredients": [
                { "item": "Chicken Breast", "quantity": "2", "unit": "count", "prep": "boneless" },
                { "item": "Lemon", "quantity": "1", "unit": "whole", "prep": "sliced" }
            ]
        },
        { "type": "Instructions", "title": "Step 1: Sear", "items": ["Sear chicken in pan."], "metadata": { "timer": "5 mins", "technique": "High Heat" } }
      ]
    }
  `;

  const prompt = `
    User Profile: ${profile.age}yo ${profile.gender}, Goal: ${profile.goals.join(', ')}.
    Skill: ${profile.fitnessLevel}.
    Allergies: ${profile.injuries.join(', ') || 'None'}.
    Dislikes: ${profile.preferences.join(', ')}.
    
    Context:
    - Cuisine: ${daily.selectedFocus}
    - Time: ${daily.duration} mins
    - Hunger: ${daily.sleepQuality}/10
    - Cravings/Context: ${daily.soreness.join(', ') || 'None'}
    - Pantry: ${daily.targetMuscleGroups.join(', ')}
    ${workoutContext ? `- SPECIAL REQUEST: ${workoutContext} - Ensure macronutrients (protein/carbs) are optimized for recovery from this specific activity.` : ''}
    
    Generate the FULL recipe JSON now.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: recipeSchema,
        temperature: 0.2, // Lower temp for valid JSON
        // Removed maxOutputTokens to prevent truncation
      },
    });

    let text = response.text || "";
    
    // Clean and Parse
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Aggressive JSON Repair: Fix missing commas often caused by LLM output
    // 1. Strings in arrays: "item1" "item2" -> "item1", "item2"
    text = text.replace(/"\s+(?=")/g, '", "');
    // 2. Objects in arrays: } { -> }, {
    text = text.replace(/}\s+(?={)/g, '}, {');
    // 3. Property start after object end: } "key" -> }, "key"
    text = text.replace(/}\s+(?=")/g, '}, "');
    // 4. Property start after array end: ] "key" -> ], "key"
    text = text.replace(/]\s+(?=")/g, '], "');
    // 5. Value followed by key (missing comma): 123 "key" or true "key"
    text = text.replace(/(\d+|true|false|null)\s+(?=")/g, '$1, "');
    // 6. Primitives in arrays (missing comma): 1 2 -> 1, 2
    text = text.replace(/(\d+|true|false|null)\s+(?=\d+|true|false|null)/g, '$1, ');

    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) text = text.substring(startIndex, endIndex + 1);

    let recipe: Recipe;
    try {
        recipe = JSON5.parse(text) as Recipe;
    } catch (e) {
        console.warn("JSON5 failed, trying standard JSON", e);
        try {
            recipe = JSON.parse(text);
        } catch (jsonError) {
            console.error("JSON parse failed. Raw text:", text);
            throw jsonError;
        }
    }
    
    // Validation
    if (!recipe.sections || recipe.sections.length < 2) {
        throw new Error("Incomplete recipe generated. Please try again.");
    }

    // Hydrate local fields
    recipe.chefPersona = chefType;
    recipe.cuisine = daily.selectedFocus;
    
    return recipe;

  } catch (error: any) {
    console.error("Error generating recipe:", error);
    if (error.message?.includes("Unterminated") || error.message?.includes("Expected ','") || error.message?.includes("JSON")) {
       throw new Error("Generation produced invalid JSON. Please try again.");
    }
    throw error;
  }
};

export const generateDishImage = async (title: string, description: string): Promise<string | null> => {
  console.log('🖼️ [Phase 1] generateDishImage called:', { title, description: description?.substring(0, 50) });
  const ai = new GoogleGenAI({ apiKey: currentApiKey });
  try {
    const prompt = `Professional food photography of ${title}. ${description}. 4k, cinematic lighting, top down view.`;
    console.log('🖼️ [Phase 1] Calling Gemini API for image generation...');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (part?.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        const dataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
        const dataLength = part.inlineData.data.length;
        console.log('✅ [Phase 1] Image generated successfully:', {
          mimeType,
          dataLength,
          dataUrlPreview: dataUrl.substring(0, 100) + '...',
          isBase64: dataUrl.startsWith('data:image/')
        });
        return dataUrl;
    }
    console.warn('⚠️ [Phase 1] No image data found in response');
    return null;
  } catch (error) {
    console.error("❌ [Phase 1] Error generating image:", error);
    return null;
  }
};

export const categorizeGroceries = async (items: string[], availableLocations: string[]): Promise<Record<string, string>> => {
  const ai = new GoogleGenAI({ apiKey: currentApiKey });
  
  const prompt = `
    I have these grocery items: ${JSON.stringify(items)}.
    I have these storage locations: ${JSON.stringify(availableLocations)}.
    
    Return a JSON object where the keys are the grocery items and the values are the best matching location name.
    Example output: { "Milk": "Fridge", "Canned Beans": "Pantry" }.
    Return only JSON.
  `;

  try {
      const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: { responseMimeType: "application/json" }
      });
      
      const text = response.text || "{}";
      return JSON5.parse(text);
  } catch (e) {
      console.error("Error sorting groceries", e);
      return {};
  }
};