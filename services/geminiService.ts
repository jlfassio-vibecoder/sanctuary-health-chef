
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { UserProfile, DailyContext, TrainerType, WorkoutPlan } from "../types";

// Initialize API Key management
const STORAGE_KEY = 'GEMINI_API_KEY';
// Note: In a real app, never hardcode the key. This is for the demo context.
const DEFAULT_KEY = 'AIzaSyCPgDl4SY_etT74EPzIU_iPxwfCFA-KEUk';

let currentApiKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) || DEFAULT_KEY : DEFAULT_KEY;

export const updateGeminiApiKey = (key: string) => {
  currentApiKey = key;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, key);
  }
};

export const getGeminiApiKey = () => currentApiKey;

// Define the response schema for structured output
const workoutSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Name of the Dish" },
    description: { type: Type.STRING, description: "Mouth-watering description of the meal" },
    difficulty: { type: Type.STRING, description: "Cooking Difficulty: Easy, Medium, Hard" },
    trainerNotes: { type: Type.STRING, description: "Chef's personal tip or flavor note" },
    totalDuration: { type: Type.NUMBER, description: "Total prep + cook time in minutes" },
    estimatedCalories: { type: Type.NUMBER, description: "Estimated calories per serving" },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["Warmup", "Main Workout", "Cooldown", "Finisher"] }, // Mapping: Warmup=Overview, Main=Recipe
          durationEstimate: { type: Type.STRING, description: "e.g., '10 mins'" },
          exercises: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Ingredient name OR Step Title" },
                sets: { type: Type.NUMBER, description: "Just put 1" },
                muscleTarget: { type: Type.STRING, description: "Ingredient Category (e.g. Dairy) OR Step Type (e.g. Chop)" },
                tempo: { type: Type.STRING, description: "Cooking Method (e.g. Bake) or N/A" },
                cues: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific cooking tips for this step" },
                setDetails: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      reps: { type: Type.STRING, description: "Ingredient Quantity (e.g. '2 cups') or Timer" },
                      weight: { type: Type.STRING, description: "Prep Note (e.g. 'Diced') or blank" },
                      duration: { type: Type.STRING, description: "Time if applicable, e.g., '45s'" },
                      rest: { type: Type.STRING, description: "Heat level (Low/Med/High)" },
                      notes: { type: Type.STRING }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

export const generateWorkout = async (
  profile: UserProfile,
  daily: DailyContext,
  trainerType: TrainerType
): Promise<WorkoutPlan> => {
  
  // Re-initialize client on every request to ensure it uses the latest key
  const ai = new GoogleGenAI({ apiKey: currentApiKey });

  const unitLabel = profile.units === 'standard' ? 'imperial' : 'metric';

  const systemInstruction = `
    You are an expert Private Chef called "${trainerType}" working for "FitCopilot Chef".
    Your goal is to generate a delicious, healthy, and tailored recipe based on the user's dietary needs and hunger level.
    
    TONE AND STYLE:
    - Adopt the persona of a ${trainerType}.
    - Keep it concise. Do not ramble.
    - STRICTLY RESPECT ALLERGIES (User's "injuries" field contains allergies).
    - Use ${unitLabel} measurements for ingredients.
    
    DATA MAPPING INSTRUCTIONS (CRITICAL):
    You must return JSON that fits a "Workout" schema, but contains RECIPE data.
    
    Structure the 'sections' array exactly like this:
    1. **Section 1 (type: "Warmup")**: This is the "Recipe Overview".
       - It must contain exactly 1 item in 'exercises'.
       - 'exercises[0].name' = "Recipe Overview".
       - 'exercises[0].cues' = [Prep Time string, Cook Time string, Serving Size string].
       
    2. **Section 2 (type: "Main Workout")**: This is the "Ingredients & Instructions".
       - Item 1 ('exercises[0]'): Name = "Ingredients List". 'cues' = [List of all ingredients with amounts]. 'muscleTarget' = "Mise en Place".
       - Item 2+ ('exercises[1...]'): These are the Cooking Steps.
         - 'name' = "Step 1: [Action]", "Step 2: [Action]".
         - 'cues' = [One or two specific instructions for this step].
         - 'setDetails[0].reps' = Timer/Duration for this step (if any).
         - 'setDetails[0].weight' = Key technique note.
    
    DO NOT deviate from this structure.
  `;

  const prompt = `
    USER PROFILE:
    - Age: ${profile.age}, Gender: ${profile.gender}
    - Weight Goal: ${profile.goals.join(', ')}
    - Cooking Skill: ${profile.fitnessLevel}
    - Allergies/Intolerances: ${profile.injuries.join(', ') || 'None'} (CRITICAL)
    - Dietary Restrictions: ${profile.medicalConditions.join(', ') || 'None'}
    - Dislikes/Equipment: ${profile.preferences.join(', ')}
    
    CURRENT CONTEXT:
    - Cuisine/Style: ${daily.selectedFocus}
    - Time Available: ${daily.duration} mins
    - Hunger Level: ${daily.sleepQuality}/10
    - Mood/Energy: ${daily.energyLevel}/10
    - Cravings: ${daily.soreness.join(', ') || 'None'}
    - Ingredients on Hand: ${daily.targetMuscleGroups.join(', ')}
    
    Generate the recipe plan now.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: workoutSchema,
        temperature: 0.4, // Low temperature to prevent hallucinations/loops
        maxOutputTokens: 4000, // Limit to prevent infinite loops
      },
    });

    let text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    // Safety cleanup for markdown code blocks if the model ignores MIME type
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const plan = JSON.parse(text) as WorkoutPlan;
    
    // --- SANITIZATION & VALIDATION ---
    // Ensure the structure exists to prevent "cannot read properties of undefined" errors in UI
    if (!plan.sections) plan.sections = [];
    
    plan.sections.forEach(section => {
        if (!section.exercises) section.exercises = [];
        section.exercises.forEach(ex => {
            if (!ex.cues) ex.cues = [];
            if (!ex.setDetails) ex.setDetails = [];
        });
    });

    // Attach the trainer type and focus to the plan object manually
    plan.trainerType = trainerType;
    plan.focus = daily.selectedFocus;
    return plan;

  } catch (error: any) {
    console.error("Error generating recipe:", error);
    if (error.message && error.message.includes("Unterminated string")) {
       throw new Error("Recipe generation failed (Response truncated). Please try again with a simpler request.");
    }
    throw error;
  }
};
