
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Recipe, RecipeSection, UnitSystem, Ingredient } from '../types';
import { saveRecipeToDb } from '../services/dbService';
import { generateDishImage } from '../services/geminiService';
import { ShoppingAuditModal } from './ShoppingAuditModal';
import { Clock, Flame, CheckCircle2, ChefHat, Timer, AlertTriangle, ChevronLeft, ChevronRight, Activity, CloudUpload, Utensils, RefreshCw, Loader2, ShoppingCart } from 'lucide-react';

interface Props {
  plan: Recipe;
  units: UnitSystem;
  userId: string;
}

// Flattened Step for the Carousel
interface DisplayStep {
  type: 'Overview' | 'Ingredients' | 'Instructions';
  data: RecipeSection;
  index: number;
}

// Section display order constants
const SECTION_ORDER = {
  OVERVIEW: 0,
  INGREDIENTS: 1,
  INSTRUCTIONS: 2,
  UNKNOWN: 99, // Fallback for unknown section types
} as const;

export const RecipeDisplay: React.FC<Props> = ({ plan, units, userId }) => {
  const [localRecipe, setLocalRecipe] = useState<Recipe>(plan);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(!!plan.id);
  
  const [dishImage, setDishImage] = useState<string | null>(localRecipe.imageUrl || null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const recipeImagesGeneratedRef = useRef<Set<string>>(new Set());

  // Audit State
  const [showAudit, setShowAudit] = useState(false);

  // Flatten the Recipe Sections into a linear flow for the carousel
  const displaySteps: DisplayStep[] = [];
  
  if (localRecipe.sections) {
      // Sort sections: Overview first, then Ingredients, then Instructions
      const sortedSections = [...localRecipe.sections].sort((a, b) => {
          const order: Record<string, number> = { 
              'Overview': SECTION_ORDER.OVERVIEW, 
              'Ingredients': SECTION_ORDER.INGREDIENTS, 
              'Instructions': SECTION_ORDER.INSTRUCTIONS 
          };
          return (order[a.type] ?? SECTION_ORDER.UNKNOWN) - (order[b.type] ?? SECTION_ORDER.UNKNOWN);
      });
      
      sortedSections.forEach((section, idx) => {
          displaySteps.push({
              type: section.type,
              data: section,
              index: idx
          });
      });
  }

  useEffect(() => {
    setLocalRecipe(plan);
    setHasSaved(!!plan.id);
    setCurrentStepIndex(0);

    // Explicitly set image from plan
    setDishImage(plan.imageUrl || null);

    // Track whether this recipe already has an image to avoid regenerating
    if (plan.id) {
      const recipeKey = plan.id;
      if (plan.imageUrl) {
        recipeImagesGeneratedRef.current.add(recipeKey);
        console.log(`✅ [RecipeDisplay] Recipe ${recipeKey} already has image - skipping generation`);
      } else {
        recipeImagesGeneratedRef.current.delete(recipeKey);
        console.log(`🔄 [RecipeDisplay] Recipe ${recipeKey} needs image - will generate`);
      }
    } else {
      // New recipe (no ID) - allow generation
      recipeImagesGeneratedRef.current.clear();
    }
  }, [plan]);

  useEffect(() => {
    const fetchImage = async () => {
      const recipeKey = localRecipe.id || `recipe-${localRecipe.title}`;

      // Skip generation if we've already processed this recipe
      if (recipeImagesGeneratedRef.current.has(recipeKey)) return;

      if (!dishImage && !isImageLoading && localRecipe.title) {
        setIsImageLoading(true);
        const imgUrl = await generateDishImage(localRecipe.title, localRecipe.description);
        if (imgUrl) {
           setDishImage(imgUrl);
           setLocalRecipe(prev => ({ ...prev, imageUrl: imgUrl }));
           recipeImagesGeneratedRef.current.add(recipeKey);
        }
        setIsImageLoading(false);
      }
    };
    fetchImage();
  }, [localRecipe.title, localRecipe.description, dishImage, isImageLoading, localRecipe.id]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < displaySteps.length - 1) setCurrentStepIndex(prev => prev + 1);
  }, [currentStepIndex, displaySteps.length]);

  const handlePrev = useCallback(() => {
    if (currentStepIndex > 0) setCurrentStepIndex(prev => prev - 1);
  }, [currentStepIndex]);

  const handleFullSave = async () => {
      setIsSaving(true);
      const newId = await saveRecipeToDb(localRecipe, userId);
      setIsSaving(false);
      if (newId) {
          setLocalRecipe(prev => ({ ...prev, id: newId }));
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  // Helper to extract all ingredients for the audit
  const getAllIngredients = (): Ingredient[] => {
      const all: Ingredient[] = [];
      localRecipe.sections.forEach(s => {
          if (s.ingredients) all.push(...s.ingredients);
      });
      return all;
  };

  const activeStep = displaySteps[currentStepIndex];

  const renderCardContent = (step: DisplayStep) => {
      const { data } = step;

      if (step.type === 'Overview') {
          // Parse Overview section items to extract Prep, Cook, and Serves
          const parseOverviewItems = (items: string[]) => {
              const extractValue = (label: string, items: string[]) => {
                  const item = items.find(i => i.toLowerCase().includes(label));
                  if (item && item.includes(':')) {
                      const parts = item.split(':');
                      if (parts.length >= 2) {
                          return parts.slice(1).join(':').trim();
                      }
                  }
                  return '';
              };
              
              const prep = extractValue('prep', items);
              const cook = extractValue('cook', items);
              const serves = extractValue('serve', items);
              return { prep, cook, serves };
          };

          const { prep, cook, serves } = parseOverviewItems(data.items || []);
          
          return (
              <div className="flex flex-col h-full relative">
                  <div className="relative h-48 md:h-64 w-full bg-slate-800 shrink-0">
                      {dishImage ? (
                          <img 
                            src={dishImage} 
                            alt={localRecipe.title} 
                            className="w-full h-full object-cover animate-in fade-in duration-1000"
                          />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                               {isImageLoading ? (
                                   <div className="flex flex-col items-center gap-2">
                                       <Loader2 className="w-8 h-8 animate-spin text-lime-500" />
                                       <span className="text-xs font-medium uppercase tracking-widest text-lime-500/80">Plating Dish...</span>
                                   </div>
                               ) : (
                                   <div className="flex flex-col items-center gap-2">
                                       <ChefHat className="w-12 h-12 opacity-20" />
                                       <span className="text-xs">No image available</span>
                                   </div>
                               )}
                          </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-90"></div>
                      <div className="absolute bottom-4 left-6 right-6">
                           <div className="flex items-center gap-2 mb-2">
                               <span className="bg-lime-500 text-slate-900 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                                   {localRecipe.chefPersona}
                               </span>
                           </div>
                           <h2 className="text-3xl font-bold text-white leading-tight shadow-black drop-shadow-lg">{localRecipe.title}</h2>
                      </div>
                  </div>

                  <div className="p-6 flex flex-col items-center justify-center flex-grow text-center">
                      <div className="text-slate-400 mb-8 max-w-md text-sm md:text-base">{localRecipe.description || ''}</div>
                      
                      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                          {prep && (
                              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                  <span className="block text-slate-500 text-xs font-bold uppercase mb-1">Prep</span>
                                  <span className="text-xl md:text-2xl font-bold text-white">{prep}</span>
                              </div>
                          )}
                          {cook && (
                              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                  <span className="block text-slate-500 text-xs font-bold uppercase mb-1">Cook</span>
                                  <span className="text-xl md:text-2xl font-bold text-white">{cook}</span>
                              </div>
                          )}
                          {serves && (
                              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 col-span-2 flex justify-between items-center px-6">
                                  <span className="text-slate-500 text-xs font-bold uppercase">Serves</span>
                                  <span className="text-xl font-bold text-lime-400">{serves}</span>
                              </div>
                          )}
                          {/* Fallback to original metrics if Overview items are not available */}
                          {!prep && !cook && !serves && (
                              <>
                                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                      <span className="block text-slate-500 text-xs font-bold uppercase mb-1">Total Time</span>
                                      <span className="text-xl md:text-2xl font-bold text-white">{localRecipe.totalTime} mins</span>
                                  </div>
                                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                      <span className="block text-slate-500 text-xs font-bold uppercase mb-1">Calories</span>
                                      <span className="text-xl md:text-2xl font-bold text-white">{localRecipe.calories}</span>
                                  </div>
                                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 col-span-2 flex justify-between items-center px-6">
                                      <span className="text-slate-500 text-xs font-bold uppercase">Difficulty</span>
                                      <span className="text-xl font-bold text-lime-400">{localRecipe.difficulty}</span>
                                  </div>
                              </>
                          )}
                      </div>
                  </div>
              </div>
          );
      }

      if (step.type === 'Ingredients') {
          return (
              <div className="flex flex-col h-full p-2 md:p-6">
                  <div className="flex items-center justify-between gap-3 mb-6 border-b border-slate-800 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-lime-500/10 rounded-xl">
                            <Utensils className="w-8 h-8 text-lime-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black text-white">{data.title}</h2>
                            <p className="text-slate-400 text-sm">Gather everything before you start.</p>
                        </div>
                      </div>
                      
                      {/* Add To Shopping List Button */}
                      <button 
                        onClick={() => setShowAudit(true)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-lime-400 border border-slate-700 p-3 rounded-xl transition-all shadow-sm"
                        title="Add to Shopping List"
                      >
                          <ShoppingCart className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="overflow-y-auto pr-2 custom-scrollbar flex-grow">
                      {(data.ingredients && data.ingredients.length > 0) ? (
                        <ul className="space-y-3">
                            {data.ingredients.map((ing, i) => (
                                <li key={i} className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-800 hover:border-lime-500/30 transition-colors">
                                    <div className="mt-1 w-2 h-2 rounded-full bg-lime-500 shrink-0" />
                                    <div>
                                        <span className="text-slate-200 text-lg leading-relaxed font-medium">{ing.item}</span>
                                        <div className="text-sm text-slate-500">{ing.quantity} {ing.unit} • {ing.prep}</div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                      ) : (data.items && data.items.length > 0) ? (
                         // Fallback for legacy recipes without structured ingredients
                         <ul className="space-y-3">
                            {data.items.map((ingredient, i) => (
                                <li key={i} className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-800 hover:border-lime-500/30 transition-colors">
                                    <div className="mt-1 w-2 h-2 rounded-full bg-lime-500 shrink-0" />
                                    <span className="text-slate-200 text-lg leading-relaxed">{ingredient}</span>
                                </li>
                            ))}
                         </ul>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                             <AlertTriangle className="w-10 h-10 mb-2 opacity-50" />
                             <p>List is empty.</p>
                        </div>
                      )}
                  </div>
              </div>
          );
      }

      // Instructions
      return (
          <div className="flex flex-col h-full p-2 md:p-6">
              <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                   <div className="flex flex-col">
                       <span className="text-xs text-lime-400 font-bold uppercase tracking-wider">Instruction</span>
                       <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">{data.title}</h2>
                   </div>
              </div>

              <div className="flex-grow overflow-y-auto">
                   <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-inner mb-6">
                       <p className="text-xl md:text-2xl text-slate-200 leading-relaxed font-medium">
                           {data.items[0]}
                       </p>
                       {(data.items || []).slice(1).map((extra, i) => (
                           <p key={i} className="mt-4 text-slate-400 text-lg">{extra}</p>
                       ))}
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                       {data.metadata?.timer && (
                           <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-3">
                               <Timer className="w-6 h-6 text-lime-500" />
                               <div>
                                   <span className="block text-slate-500 text-xs uppercase font-bold">Timer</span>
                                   <span className="text-white font-bold">{data.metadata.timer}</span>
                               </div>
                           </div>
                       )}
                       {data.metadata?.technique && (
                           <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-3 col-span-2 md:col-span-1">
                               <Activity className="w-6 h-6 text-orange-500" />
                               <div>
                                   <span className="block text-slate-500 text-xs uppercase font-bold">Technique</span>
                                   <span className="text-white font-bold">{data.metadata.technique}</span>
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
      {showAudit && (
          <ShoppingAuditModal 
            userId={userId}
            recipeId={localRecipe.id}
            ingredients={getAllIngredients()}
            onClose={() => setShowAudit(false)}
          />
      )}

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

      <div className="flex items-center justify-center gap-4 h-[75vh]">
          <button 
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="p-3 rounded-full hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all hidden md:block"
          >
            <ChevronLeft className="w-10 h-10 text-lime-400" />
          </button>

          <div className="w-full max-w-2xl h-full bg-slate-900 rounded-3xl p-1 shadow-2xl border border-slate-700 relative flex flex-col">
             <div className="absolute -inset-0.5 bg-gradient-to-br from-lime-500 to-green-600 rounded-3xl opacity-20 blur-sm pointer-events-none"></div>
             <div className="relative bg-slate-950 rounded-[22px] overflow-hidden h-full flex flex-col">
                 <div className="h-1 bg-slate-900 w-full flex shrink-0">
                     {displaySteps.map((_, idx) => (
                         <div 
                           key={idx}
                           className={`h-full flex-1 transition-all duration-300 ${idx <= currentStepIndex ? 'bg-lime-500' : 'bg-slate-800'} ${idx > 0 ? 'border-l border-slate-950' : ''}`}
                         />
                     ))}
                 </div>

                 <div className="flex-grow relative overflow-hidden flex flex-col">
                     {activeStep ? renderCardContent(activeStep) : (
                         <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                            <AlertTriangle className="w-12 h-12 mb-4 text-orange-500" />
                            <p>Recipe content incomplete.</p>
                            <button onClick={() => window.location.reload()} className="flex items-center gap-2 text-lime-400 hover:text-lime-300 mt-4">
                                <RefreshCw className="w-4 h-4" /> Reload App
                            </button>
                         </div>
                     )}
                 </div>
             </div>
          </div>

          <button 
            onClick={handleNext}
            disabled={currentStepIndex === displaySteps.length - 1}
            className="p-3 rounded-full hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all hidden md:block"
          >
            <ChevronRight className="w-10 h-10 text-lime-400" />
          </button>
      </div>
      
      <div className="mt-8 text-center text-slate-500 text-sm">
         <p>"{localRecipe.chefNote}"</p>
         <p className="mt-2 text-xs uppercase tracking-widest">- {localRecipe.chefPersona}</p>
      </div>
    </div>
  );
};
