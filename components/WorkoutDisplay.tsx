
import React, { useState, useEffect, useCallback } from 'react';
import { WorkoutPlan, Exercise, UnitSystem } from '../types';
import { saveWorkoutToDb } from '../services/dbService';
import { Clock, Flame, CheckCircle2, ChefHat, Timer, AlertTriangle, Maximize2, X, ChevronLeft, ChevronRight, Activity, Save, CloudUpload, Utensils } from 'lucide-react';

interface Props {
  plan: WorkoutPlan;
  units: UnitSystem;
  userId: string;
}

// Flattened Step for the Carousel
interface RecipeStep {
  type: 'Overview' | 'Ingredients' | 'Instruction';
  data: Exercise;
  sectionTitle: string;
  stepIndex: number; // 0 for overview, 1 for ingredients, 2+ for steps
}

export const WorkoutDisplay: React.FC<Props> = ({ plan, units, userId }) => {
  // Lift plan to state to support editing
  const [localPlan, setLocalPlan] = useState<WorkoutPlan>(plan);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(!!plan.id);

  // Flatten the "Workout" structure into a linear Recipe flow
  // Card 1: Overview (derived from Section 1)
  // Card 2: Ingredients (derived from Section 2, Exercise 1)
  // Card 3+: Steps (derived from Section 2, Exercises 2+)
  const recipeSteps: RecipeStep[] = [];
  
  // 1. Overview Card - SAFE ACCESS
  if (localPlan.sections?.[0]?.exercises?.[0]) {
      recipeSteps.push({
          type: 'Overview',
          data: localPlan.sections[0].exercises[0],
          sectionTitle: "Preparation",
          stepIndex: 0
      });
  }

  // 2. Ingredients & Instructions - SAFE ACCESS
  const mainSection = localPlan.sections?.[1];
  if (mainSection && mainSection.exercises) {
      mainSection.exercises.forEach((ex, idx) => {
          recipeSteps.push({
              type: idx === 0 ? 'Ingredients' : 'Instruction',
              data: ex,
              sectionTitle: idx === 0 ? "Mise en Place" : "Cooking",
              stepIndex: recipeSteps.length
          });
      });
  }

  useEffect(() => {
    setLocalPlan(plan);
    setHasSaved(!!plan.id);
    setCurrentStepIndex(0);
  }, [plan]);


  const handleNext = useCallback(() => {
    if (currentStepIndex < recipeSteps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentStepIndex, recipeSteps.length]);

  const handlePrev = useCallback(() => {
    if (currentStepIndex > 0) {
        setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);


  const handleFullSave = async () => {
      setIsSaving(true);
      const newId = await saveWorkoutToDb(localPlan, userId);
      setIsSaving(false);
      if (newId) {
          setLocalPlan(prev => ({ ...prev, id: newId }));
          setHasSaved(true);
          alert("Recipe saved to cookbook!"); 
      }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);


  const activeStep = recipeSteps[currentStepIndex];

  // RENDER CARD CONTENT BASED ON TYPE
  const renderCardContent = (step: RecipeStep) => {
      const { data } = step;

      // Safe Access Helpers
      const getCue = (idx: number) => data.cues && data.cues[idx] ? data.cues[idx] : "";
      const getSetDetail = (idx: number) => data.setDetails && data.setDetails[idx] ? data.setDetails[idx] : null;

      if (step.type === 'Overview') {
          return (
              <div className="flex flex-col h-full justify-center items-center text-center p-6">
                  <ChefHat className="w-20 h-20 text-lime-500 mb-6" />
                  <h2 className="text-3xl font-bold text-white mb-2">{localPlan.title}</h2>
                  <div className="text-slate-400 mb-8 max-w-md">{localPlan.description}</div>
                  
                  <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                          <span className="block text-slate-500 text-xs font-bold uppercase mb-1">Total Time</span>
                          <span className="text-2xl font-bold text-white">{getCue(0) || `${localPlan.totalDuration} mins`}</span>
                      </div>
                      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                          <span className="block text-slate-500 text-xs font-bold uppercase mb-1">Calories</span>
                          <span className="text-2xl font-bold text-white">{localPlan.estimatedCalories}</span>
                      </div>
                      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 col-span-2">
                           <span className="block text-slate-500 text-xs font-bold uppercase mb-1">Difficulty</span>
                           <span className="text-xl font-bold text-lime-400">{localPlan.difficulty}</span>
                      </div>
                  </div>
              </div>
          );
      }

      if (step.type === 'Ingredients') {
          return (
              <div className="flex flex-col h-full p-2 md:p-6">
                  <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                      <div className="p-3 bg-lime-500/10 rounded-xl">
                          <Utensils className="w-8 h-8 text-lime-400" />
                      </div>
                      <div>
                          <h2 className="text-2xl md:text-3xl font-black text-white">Ingredients</h2>
                          <p className="text-slate-400 text-sm">Gather everything before you start.</p>
                      </div>
                  </div>
                  
                  <div className="overflow-y-auto pr-2 custom-scrollbar flex-grow">
                      <ul className="space-y-3">
                          {(data.cues || []).map((ingredient, i) => (
                              <li key={i} className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-800 hover:border-lime-500/30 transition-colors">
                                  <div className="mt-1 w-2 h-2 rounded-full bg-lime-500 shrink-0" />
                                  <span className="text-slate-200 text-lg leading-relaxed">{ingredient}</span>
                              </li>
                          ))}
                      </ul>
                  </div>
              </div>
          );
      }

      // INSTRUCTIONS
      const firstDetail = getSetDetail(0);

      return (
          <div className="flex flex-col h-full p-2 md:p-6">
              <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                   <div className="flex flex-col">
                       <span className="text-xs text-lime-400 font-bold uppercase tracking-wider">Step {currentStepIndex - 1}</span>
                       <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">{data.name.replace(/^Step \d+: /, '')}</h2>
                   </div>
              </div>

              <div className="flex-grow overflow-y-auto">
                   <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-inner mb-6">
                       <p className="text-xl md:text-2xl text-slate-200 leading-relaxed font-medium">
                           {getCue(0)}
                       </p>
                       {(data.cues || []).slice(1).map((extra, i) => (
                           <p key={i} className="mt-4 text-slate-400 text-lg">{extra}</p>
                       ))}
                   </div>
                   
                   {/* Meta Data for Step */}
                   <div className="grid grid-cols-2 gap-4">
                       {firstDetail?.reps && (
                           <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-3">
                               <Timer className="w-6 h-6 text-lime-500" />
                               <div>
                                   <span className="block text-slate-500 text-xs uppercase font-bold">Timer</span>
                                   <span className="text-white font-bold">{firstDetail.reps}</span>
                               </div>
                           </div>
                       )}
                       {firstDetail?.weight && (
                           <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-3 col-span-2 md:col-span-1">
                               <Activity className="w-6 h-6 text-orange-500" />
                               <div>
                                   <span className="block text-slate-500 text-xs uppercase font-bold">Technique</span>
                                   <span className="text-white font-bold">{firstDetail.weight}</span>
                               </div>
                           </div>
                       )}
                   </div>
              </div>
          </div>
      );
  };

  return (
    <div className="animate-in slide-in-from-bottom-8 duration-700 pb-20 pt-4">
      
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-6">
           <button 
              onClick={handleFullSave}
              disabled={isSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-lg ml-auto ${
                  hasSaved 
                  ? 'bg-slate-900/50 text-lime-400 border border-lime-500/50' 
                  : 'bg-lime-500 text-slate-900 hover:bg-lime-400'
              }`}
           >
              {isSaving ? 'Saving...' : hasSaved ? 'Saved to Cookbook' : 'Save Recipe'}
              {hasSaved ? <CheckCircle2 className="w-4 h-4" /> : <CloudUpload className="w-4 h-4" />}
           </button>
      </div>

      {/* Main Recipe Card Container */}
      <div className="flex items-center justify-center gap-4 h-[70vh]">
          {/* Prev Button */}
          <button 
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="p-3 rounded-full hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all hidden md:block"
          >
            <ChevronLeft className="w-10 h-10 text-lime-400" />
          </button>

          {/* Card */}
          <div className="w-full max-w-2xl h-full bg-slate-900 rounded-3xl p-1 shadow-2xl border border-slate-700 relative flex flex-col">
             <div className="absolute -inset-0.5 bg-gradient-to-br from-lime-500 to-green-600 rounded-3xl opacity-20 blur-sm pointer-events-none"></div>
             <div className="relative bg-slate-950 rounded-[22px] overflow-hidden h-full flex flex-col">
                 
                 {/* Progress Bar */}
                 <div className="h-1 bg-slate-900 w-full flex">
                     {recipeSteps.map((_, idx) => (
                         <div 
                           key={idx}
                           className={`h-full flex-1 transition-all duration-300 ${idx <= currentStepIndex ? 'bg-lime-500' : 'bg-slate-800'} ${idx > 0 ? 'border-l border-slate-950' : ''}`}
                         />
                     ))}
                 </div>

                 <div className="flex-grow relative overflow-hidden">
                     {activeStep ? renderCardContent(activeStep) : (
                         <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                            <AlertTriangle className="w-12 h-12 mb-4 text-orange-500" />
                            <p>Recipe content incomplete. Please regenerate.</p>
                         </div>
                     )}
                 </div>
             </div>
          </div>

          {/* Next Button */}
          <button 
            onClick={handleNext}
            disabled={currentStepIndex === recipeSteps.length - 1}
            className="p-3 rounded-full hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all hidden md:block"
          >
            <ChevronRight className="w-10 h-10 text-lime-400" />
          </button>
      </div>
      
      {/* Mobile Navigation */}
      <div className="flex md:hidden gap-4 mt-6 w-full px-4">
           <button 
             onClick={handlePrev}
             disabled={currentStepIndex === 0}
             className="flex-1 bg-slate-800 py-3 rounded-xl flex justify-center items-center text-lime-400 disabled:opacity-30"
           >
             <ChevronLeft className="w-6 h-6" /> Back
           </button>
           <button 
             onClick={handleNext}
             disabled={currentStepIndex === recipeSteps.length - 1}
             className="flex-1 bg-slate-800 py-3 rounded-xl flex justify-center items-center text-lime-400 disabled:opacity-30"
           >
             Next <ChevronRight className="w-6 h-6" />
           </button>
      </div>

      <div className="mt-8 text-center text-slate-500 text-sm">
         <p>"{localPlan.trainerNotes}"</p>
         <p className="mt-2 text-xs uppercase tracking-widest">- {localPlan.trainerType}</p>
      </div>

    </div>
  );
};
