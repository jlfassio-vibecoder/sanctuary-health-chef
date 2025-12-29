
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Recipe, TrainerType } from '../types';
import { getSavedRecipes, getRecipeById, deleteRecipe, getRecipeImageUrls } from '../services/dbService';
import { Calendar, Clock, Flame, BookOpen, Trash2, ArrowRight, AlertCircle, Loader2, Utensils } from 'lucide-react';

interface Props {
  onLoadWorkout: (plan: Recipe) => void;
  userId: string;
}

// Image cache shared across component instances
const imageCache = new Map<string, string>();
const loadingRecipes = new Set<string>();

export const RecipeHistory: React.FC<Props> = ({ onLoadWorkout, userId }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCuisine, setFilterCuisine] = useState<string>('All');
  const [filterChef, setFilterChef] = useState<string>('All');
  const [loadedImages, setLoadedImages] = useState<Map<string, string>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Static chef persona options (keeps filter stable even if only one chef is present in data)
  const CHEF_PERSONA_OPTIONS: string[] = [
    TrainerType.FUNCTIONAL,
    TrainerType.HYPERTROPHY,
    TrainerType.POWERLIFTING,
    TrainerType.YOGA,
    TrainerType.HIIT,
    TrainerType.REHAB,
  ];

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadImageForRecipe = useCallback(async (recipeId: string) => {
    console.log('🖼️ [Phase 6] loadImageForRecipe called:', {
      recipeId,
      inCache: imageCache.has(recipeId),
      isLoading: loadingRecipes.has(recipeId)
    });
    
    // Skip if already cached or currently loading
    if (imageCache.has(recipeId) || loadingRecipes.has(recipeId)) {
      if (imageCache.has(recipeId)) {
        const cachedUrl = imageCache.get(recipeId)!;
        console.log('✅ [Phase 6] Using cached image:', {
          recipeId,
          cachedUrl: cachedUrl.substring(0, 100) + '...'
        });
        setLoadedImages(prev => new Map(prev).set(recipeId, cachedUrl));
      }
      return;
    }

    loadingRecipes.add(recipeId);
    try {
      console.log('📖 [Phase 6] Fetching image URL for recipe:', recipeId);
      const imageMap = await getRecipeImageUrls([recipeId]);
      const imageUrl = imageMap.get(recipeId);
      
      console.log('📖 [Phase 6] Image fetch result:', {
        recipeId,
        hasImageUrl: !!imageUrl,
        imageUrl: imageUrl ? imageUrl.substring(0, 100) + '...' : null
      });
      
      if (imageUrl) {
        // Cache the image
        imageCache.set(recipeId, imageUrl);
        setLoadedImages(prev => new Map(prev).set(recipeId, imageUrl));
        console.log('✅ [Phase 6] Image loaded and cached:', {
          recipeId,
          imageUrl: imageUrl.substring(0, 100) + '...'
        });
        
        // Update recipe state
        setRecipes(prevRecipes => 
          prevRecipes.map(recipe => 
            recipe.id === recipeId ? { ...recipe, imageUrl } : recipe
          )
        );
      } else {
        console.warn('⚠️ [Phase 6] No image URL found for recipe:', recipeId);
      }
    } catch (error) {
      console.error(`❌ [Phase 6] Error loading image for recipe ${recipeId}:`, error);
    } finally {
      loadingRecipes.delete(recipeId);
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    // Exclude images when loading history to speed up query and prevent timeouts
    // Images will be loaded lazily as cards come into view
    const data = await getSavedRecipes(userId, false);
    
    // Check cache for any images we already have
    const cachedImages = new Map<string, string>();
    data.forEach(recipe => {
      if (recipe.id && imageCache.has(recipe.id)) {
        cachedImages.set(recipe.id, imageCache.get(recipe.id)!);
      }
    });
    
    // Initialize recipes with cached images
    const recipesWithCachedImages = data.map(recipe => ({
      ...recipe,
      imageUrl: (recipe.id && cachedImages.get(recipe.id)) || recipe.imageUrl || ''
    }));
    
    setRecipes(recipesWithCachedImages);
    setLoadedImages(cachedImages);
    setLoading(false);
  };

  // Set up Intersection Observer for lazy loading
  useEffect(() => {
    if (loading) return;

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new Intersection Observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const recipeId = entry.target.getAttribute('data-recipe-id');
            if (recipeId && !loadedImages.has(recipeId) && !loadingRecipes.has(recipeId)) {
              loadImageForRecipe(recipeId);
            }
          }
        });
      },
      {
        rootMargin: '100px' // Start loading 100px before card enters viewport
      }
    );

    // Observe all recipe cards
    cardRefs.current.forEach((cardElement) => {
      if (cardElement && observerRef.current) {
        observerRef.current.observe(cardElement);
      }
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [recipes, loading, loadedImages, loadImageForRecipe]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to remove this recipe?")) {
       const success = await deleteRecipe(id);
       if (success) {
         setRecipes(prev => prev.filter(r => r.id !== id));
       }
    }
  };

  const cuisinesFound = Array.from(new Set(recipes.map(r => r.cuisine || 'General'))).sort();
  
  const filteredRecipes = recipes.filter(r => {
    const chefMatch = filterChef === 'All' || (r.chefPersona || 'Other') === filterChef;
    const cuisineMatch = filterCuisine === 'All' || (r.cuisine || 'General') === filterCuisine;
    return chefMatch && cuisineMatch;
  });

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-[#f0dc7a] mb-4" />
            <p>Opening cookbook...</p>
        </div>
    );
  }

  if (recipes.length === 0) {
      return (
          <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800">
              <BookOpen className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No Recipes Saved</h3>
              <p className="text-slate-400">Generate and save a recipe to start your cookbook.</p>
          </div>
      );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
           <h2 className="text-3xl font-bold text-white">Your Cookbook</h2>
           <p className="text-slate-400">Revisit your favorite generated meals.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
           <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
                <span className="text-xs font-bold text-slate-500 uppercase px-2">Chef:</span>
                <select 
                    value={filterChef}
                    onChange={(e) => setFilterChef(e.target.value)}
                    className="bg-transparent text-white text-sm outline-none cursor-pointer pr-4"
                >
                    <option value="All">All</option>
                    {CHEF_PERSONA_OPTIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
           </div>
           
           <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
                <span className="text-xs font-bold text-slate-500 uppercase px-2">Cuisine:</span>
                <select 
                    value={filterCuisine}
                    onChange={(e) => setFilterCuisine(e.target.value)}
                    className="bg-transparent text-white text-sm outline-none cursor-pointer pr-4"
                >
                    <option value="All">All</option>
                    {cuisinesFound.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredRecipes.map((recipe) => {
          const recipeId = recipe.id!;
          const displayImageUrl = loadedImages.get(recipeId) || recipe.imageUrl || '';
          
          return (
            <div 
                key={recipeId}
                ref={(el) => {
                  if (el) {
                    cardRefs.current.set(recipeId, el);
                  } else {
                    cardRefs.current.delete(recipeId);
                  }
                }}
                data-recipe-id={recipeId}
                onClick={async () => {
                    // If the recipe already has an image, use it. Otherwise fetch with images.
                    if (displayImageUrl) {
                        onLoadWorkout(recipe);
                        return;
                    }
                    // Ensure we have the full recipe with image before navigating
                    if (!displayImageUrl) {
                      await loadImageForRecipe(recipeId);
                    }
                    const fullRecipe = await getRecipeById(recipeId, true);
                    onLoadWorkout(fullRecipe || recipe);
                }}
                className="bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-[#f0dc7a]/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-[#807048]/10 group relative"
            >
                {displayImageUrl && (
                    <div className="relative h-48 md:h-64 w-full bg-slate-800 shrink-0 -mx-5 -mt-5 mb-0">
                        <img 
                            src={displayImageUrl} 
                            alt={recipe.title}
                            className="w-full h-full object-cover animate-in fade-in duration-1000"
                            onLoad={() => {
                              console.log('✅ [Phase 6] Image loaded successfully in RecipeHistory:', {
                                recipeId,
                                imageType: displayImageUrl.startsWith('data:') ? 'base64' : 'storage'
                              });
                            }}
                            onError={(e) => {
                              console.error('❌ [Phase 6] Image failed to load in RecipeHistory:', {
                                recipeId,
                                src: displayImageUrl.substring(0, 100) + '...',
                                imageType: displayImageUrl.startsWith('data:') ? 'base64' : 'storage',
                                error: e
                              });
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-90"></div>
                        <div className="absolute bottom-4 left-6 right-6">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-[#f0dc7a] text-slate-900 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                                    {recipe.chefPersona}
                                </span>
                            </div>
                            <h3 className="text-3xl font-bold text-white leading-tight shadow-black drop-shadow-lg">{recipe.title}</h3>
                        </div>
                    </div>
                )}
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                    <div className="flex-1 w-full">
                        {!displayImageUrl && (
                            <>
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-slate-900 text-slate-300 border border-slate-700`}>
                                        {recipe.chefPersona}
                                    </span>
                                    {recipe.cuisine && (
                                        <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-[#807048]/30 text-[#f0dc7a] border border-[#9c8c53]/50`}>
                                            <Utensils className="w-3 h-3" />
                                            {recipe.cuisine}
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#f0dc7a] transition-colors">{recipe.title}</h3>
                            </>
                        )}
                        {recipe.cuisine && displayImageUrl && (
                            <div className="flex flex-wrap items-center gap-2 mb-3 mt-4">
                                <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-[#807048]/30 text-[#f0dc7a] border border-[#9c8c53]/50`}>
                                    <Utensils className="w-3 h-3" />
                                    {recipe.cuisine}
                                </span>
                            </div>
                        )}
                        
                        <div className="flex flex-col gap-2 text-sm text-slate-400">
                             <div className="flex items-center gap-2 mb-1">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                <span className="text-xs font-mono">{recipe.createdAt ? new Date(recipe.createdAt).toLocaleDateString() : 'Unknown Date'}</span>
                             </div>
                             
                             <p className="text-slate-400 leading-relaxed pr-8 line-clamp-2">
                                {recipe.description}
                             </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                         <div className="flex items-center gap-6 text-sm bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-2 text-slate-300">
                                <Clock className="w-4 h-4 text-[#f0dc7a]" />
                                <span className="font-bold">{recipe.totalTime} min</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                                <Flame className="w-4 h-4 text-orange-500" />
                                <span className="font-bold">{recipe.calories} kcal</span>
                            </div>
                        </div>
                        
                        <div className="hidden md:flex items-center justify-center w-full py-2 rounded-lg bg-slate-700/30 group-hover:bg-[#f0dc7a] group-hover:text-slate-900 transition-all font-bold text-xs uppercase tracking-wide mt-auto">
                            View Recipe <ArrowRight className="w-4 h-4 ml-1" />
                        </div>
                    </div>
                </div>

                <button 
                   onClick={(e) => handleDelete(recipe.id!, e)}
                   className="absolute top-4 right-4 p-2 text-slate-600 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors opacity-0 group-hover:opacity-100 z-10"
                   title="Delete Recipe"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
          );
        })}
        
        {filteredRecipes.length === 0 && (
            <div className="text-center py-10 border border-dashed border-slate-700 rounded-xl">
                <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500">No recipes found matching these filters.</p>
                <button 
                  onClick={() => { setFilterCuisine('All'); setFilterChef('All'); }}
                  className="mt-4 text-[#f0dc7a] text-sm hover:underline"
                >
                  Clear Filters
                </button>
            </div>
        )}
      </div>
    </div>
  );
};
