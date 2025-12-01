
import { createClient } from '@supabase/supabase-js';
import { WorkoutPlan, WorkoutSection, Exercise, UserProfile } from '../types';

// Robust helper to find environment variables in various setups (Vite vs Node/Webpack)
const getEnvVar = (key: string): string | undefined => {
  // 1. Try Vite's import.meta.env
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) { /* ignore */ }

  // 2. Try Standard process.env
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) { /* ignore */ }

  return undefined;
};

// Configuration
const SUPABASE_URL = 
    getEnvVar('VITE_SUPABASE_URL') || 
    getEnvVar('SUPABASE_URL') || 
    getEnvVar('NEXT_PUBLIC_SUPABASE_URL') ||
    "https://gqnopyppoueycchidehr.supabase.co";

const SUPABASE_KEY = 
    getEnvVar('VITE_SUPABASE_KEY') || 
    getEnvVar('SUPABASE_KEY') || 
    getEnvVar('VITE_SUPABASE_ANON_KEY') || 
    getEnvVar('SUPABASE_ANON_KEY') ||
    getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
    "sb_publishable_X5SIUzQz3_kuEd5Uj7oxQQ_wYgO5BYb";

// Initialize Supabase Client
let supabase: any = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("✅ Supabase initialized connected to:", SUPABASE_URL);
  } catch (error) {
    console.error("❌ Error initializing Supabase client:", error);
  }
} else {
  console.warn("⚠️ Supabase credentials missing.");
}

export { supabase };

/**
 * Verifies that the database table exists and has the required columns.
 */
export const verifyDatabaseSchema = async (): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Client not initialized" };

    try {
        // Check Workouts Table
        const { error: workoutsError } = await supabase
            .from('workouts')
            .select('id, total_duration, estimated_calories, trainer_type, focus')
            .limit(1);

        if (workoutsError) {
            console.error("Workouts Schema Verification Error:", workoutsError);
            if (workoutsError.code === 'PGRST205' || workoutsError.message?.includes("does not exist")) {
                 return { success: false, message: "Missing Table: 'workouts'. Please run the Setup SQL." };
            }
            return { success: false, message: `Workouts Table Error: ${workoutsError.message}` };
        }

        // Check Profile Attributes Table (Switched from 'profiles')
        const { error: profilesError } = await supabase
            .from('profile_attributes')
            .select('id')
            .limit(1);

        if (profilesError && profilesError.code !== 'PGRST116') { // Ignore "no rows" error
             if (profilesError.code === '42P01' || profilesError.message?.includes("does not exist")) {
                 return { success: false, message: "Missing Table: 'profile_attributes'. Please run the Setup SQL." };
             }
             if (profilesError.message?.includes('column "id" does not exist')) {
                 return { success: false, message: "Profile Attributes Table Schema Mismatch (id column missing)" };
             }
        }

        return { success: true, message: "Tables & Columns Verified" };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

/**
 * Retrieves the user profile from Supabase.
 * Robustly checks both 'id' and 'user_id' columns.
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    if (!supabase) return null;

    try {
        // Attempt 1: Standard 'id' column on profile_attributes
        let { data, error } = await supabase
            .from('profile_attributes')
            .select('*')
            .eq('id', userId)
            .single();

        // Attempt 2: Fallback to 'user_id' column if 'id' lookup failed (row not found)
        if (!data && (error?.code === 'PGRST116' || !error)) {
             // Quiet logging for fallback attempt
             const { data: data2, error: error2 } = await supabase
                .from('profile_attributes')
                .select('*')
                .eq('user_id', userId)
                .single();
             
             if (data2) {
                 data = data2;
                 error = null;
             }
        }

        if (error) {
            // Check for potential RLS issues (Policy Violation often returns empty result or specific code)
            if (error.code !== 'PGRST116') { 
                console.error("Error fetching profile:", JSON.stringify(error, null, 2));
            } else {
                // This is normal for new users
                console.log(`ℹ️ No existing profile found for ${userId}. Creating new profile...`);
            }
            return null;
        }

        if (!data) return null;

        // Map Snake_Case DB columns to CamelCase TS Interface
        return {
            age: data.age,
            gender: data.gender,
            weight: data.weight,
            height: data.height,
            units: data.units as 'standard' | 'metric',
            fitnessLevel: data.fitness_level as any,
            goals: data.goals || [],
            injuries: data.injuries || [],
            medicalConditions: data.medical_conditions || [],
            preferences: data.preferences || []
        };
    } catch (e) {
        console.error("Unexpected error fetching profile:", e);
        return null;
    }
};

/**
 * Saves/Updates the user profile in Supabase.
 */
export const saveUserProfile = async (userId: string, profile: UserProfile): Promise<boolean> => {
    if (!supabase) {
        alert("Cannot save profile: Database disconnected.");
        return false;
    }

    try {
        // Map CamelCase TS Interface to Snake_Case DB columns
        const payload = {
            id: userId, // Primary ID
            user_id: userId, // Redundant but helpful for schema compatibility
            age: profile.age,
            gender: profile.gender,
            weight: profile.weight,
            height: profile.height,
            units: profile.units,
            fitness_level: profile.fitnessLevel,
            goals: profile.goals,
            injuries: profile.injuries,
            medical_conditions: profile.medicalConditions,
            preferences: profile.preferences,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('profile_attributes') // Switched from 'profiles'
            .upsert(payload, { onConflict: 'id' }); 

        if (error) {
            console.error("Error saving profile:", JSON.stringify(error, null, 2));
            alert(`Failed to save profile: ${error.message}`);
            return false;
        }

        console.log("✅ User profile synced to database.");
        return true;
    } catch (e) {
        console.error("Unexpected error saving profile:", e);
        return false;
    }
};

/**
 * Saves or Updates a workout plan to the Supabase database.
 */
export const saveWorkoutToDb = async (workout: WorkoutPlan, userId: string): Promise<string | null> => {
  if (!supabase) {
    console.error("Cannot save workout: Supabase client is not initialized.");
    alert("Cannot save workout: Supabase client is not initialized.");
    return null;
  }

  console.log("Syncing workout to Supabase...", workout.title);

  try {
    let workoutId = workout.id;
    const safeFocus = workout.focus || workout.trainerType || workout.title || "General Fitness";
    const safeDuration = workout.totalDuration || 60;

    // Collect all exercise names
    let exerciseNames = workout.sections.flatMap(section => 
        section.exercises.map(ex => ex.name)
    );

    // FIX: Ensure exerciseNames is never empty if the DB constraint is strict
    if (!exerciseNames || exerciseNames.length === 0) {
        exerciseNames = ["General Exercise"]; 
    }

    // 1. Prepare Payload for 'workouts' table
    const payload: any = {
      user_id: userId,
      title: workout.title,
      description: workout.description,
      difficulty: workout.difficulty,
      trainer_notes: workout.trainerNotes,
      
      // Map to 'total_duration' (Standard) AND 'duration' (Legacy/Current DB Schema)
      total_duration: safeDuration,
      duration: safeDuration, 
      
      estimated_calories: workout.estimatedCalories,
      created_at: workout.createdAt || new Date().toISOString(),
      trainer_type: workout.trainerType || null,
      focus: safeFocus,
      
      // Fix for Error 23502 (Not Null constraint on 'exercises')
      // Ensure this is never null/undefined
      exercises: exerciseNames 
    };

    let data;
    let error;
    let attempts = 0;
    const maxAttempts = 5; 

    // Retry Loop for Schema Compatibility
    while (attempts < maxAttempts) {
        attempts++;
        
        let query;
        let isUpdate = false;

        if (workoutId) {
            // Attempt Update
            isUpdate = true;
            query = supabase.from('workouts').update(payload).eq('id', workoutId).select('id').single();
        } else {
            // Attempt Insert
            query = supabase.from('workouts').insert([payload]).select('id').single();
        }

        const result = await query;
        data = result.data;
        error = result.error;

        if (!error) {
            break; // Success!
        }

        if (isUpdate && (error.code === 'PGRST116' || error.details?.includes('0 rows'))) {
            console.warn("⚠️ Update failed (ID not found). Switching to INSERT.");
            workoutId = undefined; 
            continue;
        }

        // Check for "Missing Column" errors (Postgres Code 42703)
        const msg = error.message || error.details || "";
        const isMissingColumnError = error.code === '42703' || msg.includes('does not exist');

        if (isMissingColumnError) {
            const missingColMatch = msg.match(/Could not find the '(\w+)' column/) || msg.match(/column "(\w+)" of relation/);
            
            if (missingColMatch) {
                const missingCol = missingColMatch[1];
                console.warn(`⚠️ DB Schema Mismatch (Attempt ${attempts}): Column '${missingCol}' missing in 'workouts' table. Removing field and retrying.`);
                delete payload[missingCol];
            } else {
                console.error("Supabase Error (Table: workouts):", JSON.stringify(error, null, 2));
                throw error;
            }
        } else {
            console.error("Supabase Error (Table: workouts):", JSON.stringify(error, null, 2));
            throw error;
        }
    }

    if (error) {
       throw error;
    }

    if (!data || !data.id) {
        throw new Error("Save succeeded but no ID returned.");
    }

    workoutId = data.id;

    // 2. Handle Exercises
    if (workout.id || workoutId) {
        await supabase.from('workout_exercises').delete().eq('workout_id', workoutId);
    }

    const exercisesToInsert: any[] = [];

    workout.sections.forEach(section => {
      section.exercises.forEach(exercise => {
        exercisesToInsert.push({
          workout_id: workoutId,
          section_type: section.type,
          name: exercise.name,
          muscle_target: exercise.muscleTarget,
          sets_count: exercise.sets,
          tempo: exercise.tempo || null,
          cues: exercise.cues || [],
          set_details: exercise.setDetails || []
        });
      });
    });

    const { error: exercisesError } = await supabase
      .from('workout_exercises')
      .insert(exercisesToInsert);

    if (exercisesError) {
      console.error("Supabase Error (Table: workout_exercises):", JSON.stringify(exercisesError, null, 2));
      throw exercisesError;
    }

    console.log("✅ Workout successfully saved/updated. ID:", workoutId);
    return workoutId;

  } catch (error: any) {
    console.error("Critical error saving to Supabase:", JSON.stringify(error, null, 2));
    alert(`Failed to save workout: ${error.message || "Unknown error. Check console."}`);
    return null;
  }
};

/**
 * Fetches all workouts for a user
 */
export const getUserWorkouts = async (userId: string): Promise<WorkoutPlan[]> => {
    if (!supabase) return [];

    try {
        const { data: workoutsData, error: workoutsError } = await supabase
            .from('workouts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (workoutsError) {
             console.error("Error fetching workouts metadata:", JSON.stringify(workoutsError, null, 2));
             throw workoutsError;
        }
        
        if (!workoutsData || workoutsData.length === 0) return [];

        const workoutIds = workoutsData.map((w: any) => w.id);
        const { data: exercisesData, error: exercisesError } = await supabase
            .from('workout_exercises')
            .select('*')
            .in('workout_id', workoutIds);

        if (exercisesError) {
             console.error("Error fetching exercises:", JSON.stringify(exercisesError, null, 2));
             throw exercisesError;
        }

        const fullPlans: WorkoutPlan[] = workoutsData.map((w: any) => {
            const planExercises = exercisesData.filter((e: any) => e.workout_id === w.id);
            const sectionMap = new Map<string, Exercise[]>();
            const sectionTypes = ['Warmup', 'Main Workout', 'Cooldown', 'Finisher'];
            
            planExercises.forEach((e: any) => {
                const exObj: Exercise = {
                    name: e.name,
                    muscleTarget: e.muscle_target,
                    sets: e.sets_count,
                    tempo: e.tempo,
                    cues: e.cues || [],
                    setDetails: e.set_details || []
                };

                const currentList = sectionMap.get(e.section_type) || [];
                currentList.push(exObj);
                sectionMap.set(e.section_type, currentList);
            });

            const sections: WorkoutSection[] = [];
            sectionTypes.forEach(type => {
                if (sectionMap.has(type)) {
                    sections.push({
                        type: type as any,
                        durationEstimate: 'N/A', 
                        exercises: sectionMap.get(type)!
                    });
                }
            });

            return {
                id: w.id,
                title: w.title,
                description: w.description,
                difficulty: w.difficulty,
                trainerNotes: w.trainer_notes,
                totalDuration: w.total_duration || w.duration, // Handle legacy column
                estimatedCalories: w.estimated_calories,
                createdAt: w.created_at,
                trainerType: w.trainer_type || undefined,
                focus: w.focus || undefined,
                sections: sections
            };
        });

        return fullPlans;

    } catch (error: any) {
        console.error("Error fetching history:", JSON.stringify(error, null, 2));
        return [];
    }
};

export const deleteWorkout = async (workoutId: string): Promise<boolean> => {
    if (!supabase) return false;
    const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
    if (error) {
        console.error("Error deleting workout:", JSON.stringify(error, null, 2));
        return false;
    }
    return true;
};
