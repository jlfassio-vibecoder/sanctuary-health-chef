
import React, { useState, useEffect } from 'react';
import { DailyContext, TrainerType, TRAINER_FOCUS_OPTIONS } from '../types';
import { Battery, Clock, Zap, PlayCircle, Loader2, Target, ChefHat, Utensils, XCircle, Dumbbell } from 'lucide-react';
import { getRecentWorkouts } from '../services/dbService';
import { auth } from '../src/lib/firebase';

interface Props {
  onSubmit: (data: DailyContext, trainer: TrainerType) => void;
  isLoading: boolean;
}

const TRAINER_DETAILS: Record<TrainerType, { description: string; activeClass: string; borderClass: string }> = {
  [TrainerType.FUNCTIONAL]: {
    description: "Balanced, whole foods for everyday health",
    activeClass: "bg-green-500/20 border-green-500",
    borderClass: "border-l-4 border-l-green-500"
  },
  [TrainerType.HYPERTROPHY]: {
    description: "Maximize protein for muscle growth",
    activeClass: "bg-red-500/20 border-red-500",
    borderClass: "border-l-4 border-l-red-500"
  },
  [TrainerType.POWERLIFTING]: {
    description: "Hearty, filling, comfort meals",
    activeClass: "bg-blue-500/20 border-blue-500",
    borderClass: "border-l-4 border-l-blue-500"
  },
  [TrainerType.YOGA]: {
    description: "Plant-focused, light, and organic",
    activeClass: "bg-purple-500/20 border-purple-500",
    borderClass: "border-l-4 border-l-purple-500"
  },
  [TrainerType.HIIT]: {
    description: "Quick, efficient, high-energy meals",
    activeClass: "bg-orange-500/20 border-orange-500",
    borderClass: "border-l-4 border-l-orange-500"
  },
  [TrainerType.REHAB]: {
    description: "Gut-friendly, anti-inflammatory",
    activeClass: "bg-cyan-500/20 border-cyan-500",
    borderClass: "border-l-4 border-l-cyan-500"
  }
};

export const DailyCheckIn: React.FC<Props> = ({ onSubmit, isLoading }) => {
  const [trainer, setTrainer] = useState<TrainerType>(TrainerType.FUNCTIONAL);
  const [selectedFocus, setSelectedFocus] = useState<string>(TRAINER_FOCUS_OPTIONS[TrainerType.FUNCTIONAL][0]);
  
  const [duration, setDuration] = useState(45);
  const [hunger, setHunger] = useState(7);
  const [mood, setMood] = useState(7);
  const [cravings, setCravings] = useState('');
  const [pantry, setPantry] = useState('');
  
  // Workout Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [importedContext, setImportedContext] = useState<string | null>(null);

  // Dynamic loading state
  const [loadingMessage, setLoadingMessage] = useState("Firing up the stove...");

  // Update focus options when trainer changes
  useEffect(() => {
    if (TRAINER_FOCUS_OPTIONS[trainer]) {
        setSelectedFocus(TRAINER_FOCUS_OPTIONS[trainer][0]);
    }
  }, [trainer]);

  useEffect(() => {
    if (!isLoading) return;

    const messages = [
      "Checking your allergies...",
      "Consulting the Chef...",
      `Applying ${trainer} philosophy...`,
      `Designing a ${selectedFocus} dish...`,
      "Balancing the flavors...",
      "Calculating cooking times...",
      "Writing the recipe...",
      "Adding plating instructions...",
      "Serving up your plan..."
    ];

    let currentIndex = 0;
    setLoadingMessage(messages[0]);

    const intervalId = setInterval(() => {
      currentIndex = (currentIndex + 1) % messages.length;
      setLoadingMessage(messages[currentIndex]);
    }, 3500);

    return () => clearInterval(intervalId);
  }, [isLoading, trainer, selectedFocus]);

  const handleFetchWorkouts = async () => {
    // Get current user from Firebase auth
    const userId = auth.currentUser?.uid;
    
    if (userId) {
      const workouts = await getRecentWorkouts(userId);
      setRecentWorkouts(workouts);
      setShowImportModal(true);
    } else {
      console.warn('No user authenticated - cannot fetch workouts');
    }
  };

  const handleImportWorkout = (workout: any) => {
    // 1. Set Duration based on workout length + cooking time (assuming 30-45 mins needed)
    setDuration(45); 

    // 2. Set Context in Cravings/Pantry to guide AI
    setImportedContext(`Recovery Meal for: ${workout.title} (${workout.total_duration}m)`);
    setCravings(`Post-Workout Recovery: ${workout.title}`);
    
    // 3. Auto-select Chef based on workout type if mapped
    if (workout.trainer_type) {
        // Try to match, otherwise keep default
        // This relies on trainer_type strings matching partially or exactly
        // For now, we will just inform the user
    }
    
    setShowImportModal(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Prevent double submit

    const context: DailyContext = {
      duration,
      sleepQuality: hunger, 
      energyLevel: mood,
      soreness: cravings ? cravings.split(',').map(s => s.trim()) : [], 
      targetMuscleGroups: pantry ? pantry.split(',').map(s => s.trim()) : ['Whatever is fresh'],
      equipmentAvailable: importedContext ? [importedContext] : [], // Pass workout context via unused field
      workoutType: 'Recipe',
      selectedFocus: selectedFocus
    };
    onSubmit(context, trainer);
  };

  return (
    <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden relative">
      <div className="p-6 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
        <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Utensils className="w-5 h-5 text-lime-400" /> Meal Planner
            </h2>
            <p className="text-slate-400 text-sm mt-1">What are you in the mood for today?</p>
        </div>
        <button 
            type="button"
            onClick={handleFetchWorkouts}
            className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg transition-colors text-slate-300"
        >
            <Dumbbell className="w-4 h-4 text-lime-400" /> Import Workout
        </button>
      </div>
      
      {importedContext && (
         <div className="bg-lime-500/10 border-b border-lime-500/20 px-6 py-2 flex items-center justify-between">
             <span className="text-xs text-lime-400 font-bold flex items-center gap-2">
                 <Dumbbell className="w-3 h-3" /> Context: {importedContext}
             </span>
             <button onClick={() => { setImportedContext(null); setCravings(''); }} className="text-slate-500 hover:text-white"><XCircle className="w-4 h-4" /></button>
         </div>
      )}

      {showImportModal && (
        <div className="absolute inset-0 z-20 bg-slate-900/95 backdrop-blur-sm flex flex-col p-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">Select a Past Workout</h3>
                <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white"><XCircle className="w-6 h-6" /></button>
            </div>
            
            <div className="space-y-2 overflow-y-auto custom-scrollbar flex-grow">
                {recentWorkouts.length === 0 ? (
                    <div className="text-center text-slate-500 py-10">
                        <p>No recent workouts found in history.</p>
                    </div>
                ) : (
                    recentWorkouts.map(w => (
                        <button 
                            key={w.id}
                            onClick={() => handleImportWorkout(w)}
                            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-xl text-left transition-colors flex justify-between items-center group"
                        >
                            <div>
                                <div className="font-bold text-white group-hover:text-lime-400 transition-colors">{w.title}</div>
                                <div className="text-xs text-slate-500 mt-1">{new Date(w.created_at).toLocaleDateString()} • {w.total_duration} mins</div>
                            </div>
                            <span className="text-xs bg-slate-900 px-2 py-1 rounded text-slate-400 border border-slate-800">Select</span>
                        </button>
                    ))
                )}
            </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        {/* Trainer Selector */}
        <div>
          <label className="block text-slate-300 font-medium mb-3">Choose Your Chef</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.values(TrainerType).map((t) => {
              const details = TRAINER_DETAILS[t];
              const isSelected = trainer === t;
              
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrainer(t)}
                  className={`p-4 rounded-lg text-left transition-all border relative overflow-hidden group ${
                    isSelected 
                      ? `${details.activeClass} border text-white shadow-lg` 
                      : `bg-slate-900 border-slate-700 hover:border-slate-600 ${details.borderClass}`
                  }`}
                >
                  <div className="relative z-10">
                    <div className="font-bold text-sm mb-1 text-white">{t}</div>
                    <div className={`text-xs ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>
                      {details.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Focus Selector */}
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
           <label className="block text-lime-400 font-bold mb-3 flex items-center gap-2">
             <ChefHat className="w-5 h-5" />
             Cuisine / Style
           </label>
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {TRAINER_FOCUS_OPTIONS[trainer]?.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSelectedFocus(option)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                    selectedFocus === option
                      ? 'bg-lime-500 text-slate-900 shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {option}
                </button>
              ))}
           </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
            <label className="flex items-center justify-between text-slate-300 mb-2">
              <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Time Available</span>
              <span className="text-lime-400 font-bold">{duration}m</span>
            </label>
            <input 
              type="range" min="15" max="120" step="5"
              value={duration} onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full accent-lime-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
            <label className="flex items-center justify-between text-slate-300 mb-2">
              <span className="flex items-center gap-2"><Utensils className="w-4 h-4" /> Hunger Level</span>
              <span className={`font-bold ${hunger > 7 ? 'text-red-400' : 'text-green-400'}`}>{hunger}/10</span>
            </label>
            <input 
              type="range" min="1" max="10"
              value={hunger} onChange={(e) => setHunger(Number(e.target.value))}
              className="w-full accent-green-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
            <label className="flex items-center justify-between text-slate-300 mb-2">
              <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Mood / Energy</span>
              <span className={`font-bold ${mood < 5 ? 'text-red-400' : 'text-yellow-400'}`}>{mood}/10</span>
            </label>
            <input 
              type="range" min="1" max="10"
              value={mood} onChange={(e) => setMood(Number(e.target.value))}
              className="w-full accent-yellow-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Text Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 text-xs uppercase mb-1">Cravings / Goal</label>
            <input 
              type="text" 
              value={cravings}
              onChange={(e) => setCravings(e.target.value)}
              placeholder="e.g. Something spicy, Pasta"
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 focus:border-lime-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs uppercase mb-1">Ingredients to Use Up</label>
            <input 
              type="text" 
              value={pantry}
              onChange={(e) => setPantry(e.target.value)}
              placeholder="e.g. Chicken thighs, Spinach"
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 focus:border-lime-500 outline-none"
            />
          </div>
        </div>

        <button 
          disabled={isLoading}
          type="submit"
          className="w-full bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-400 hover:to-green-500 text-slate-900 font-bold py-4 rounded-xl shadow-lg transform transition-all hover:scale-[1.01] flex items-center justify-center gap-2 disabled:opacity-90 disabled:cursor-wait"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin shrink-0" /> 
              <span className="animate-pulse">{loadingMessage}</span>
            </>
          ) : (
            <>
              <ChefHat className="w-6 h-6" /> Generate Recipe
            </>
          )}
        </button>
        
        {/* Helper text if hanging */}
        {isLoading && (
            <p className="text-center text-xs text-slate-500 animate-pulse">
                This might take up to 20 seconds.
            </p>
        )}
      </form>
    </div>
  );
};
