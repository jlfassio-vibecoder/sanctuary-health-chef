
import React, { useState, useEffect } from 'react';
import { getShoppingList, toggleShoppingItem, getUserLocations, moveShoppingToInventory } from '../services/dbService';
import { categorizeGroceries } from '../services/geminiService';
import { ShoppingListItem, Location } from '../types';
import { ShoppingCart, Check, Loader2, MapPin, ArrowRight, AlertCircle, RefreshCw, Layers } from 'lucide-react';

interface Props {
  userId: string;
}

export const ShoppingList: React.FC<Props> = ({ userId }) => {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Checkout / Sorting State
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isSorting, setIsSorting] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  // Map ItemName -> LocationId
  const [locationMap, setLocationMap] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    const [listData, locData] = await Promise.all([
        getShoppingList(userId),
        getUserLocations(userId)
    ]);
    setItems(listData);
    setLocations(locData);
    setLoading(false);
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    // Optimistic Update
    setItems(prev => prev.map(i => i.id === id ? { ...i, isChecked: !currentStatus } : i));
    await toggleShoppingItem(id, !currentStatus);
  };

  const handleCheckoutStart = async () => {
    const checkedItems = items.filter(i => i.isChecked);
    if (checkedItems.length === 0) {
        alert("No items checked off to move.");
        return;
    }

    setIsCheckingOut(true);
    setIsSorting(true);

    try {
        // 1. Get AI Categorization
        const itemNames = checkedItems.map(i => i.name);
        const locationNames = locations.map(l => l.name);
        
        const mapping = await categorizeGroceries(itemNames, locationNames);
        
        // 2. Convert Location Names to IDs
        const idMap: Record<string, string> = {};
        
        // Helper to find loc ID by name (case insensitive)
        const findLocId = (name: string) => locations.find(l => l.name.toLowerCase() === name.toLowerCase())?.id;
        
        // Fallback ID (usually Pantry)
        const defaultId = locations.find(l => l.name === 'Pantry')?.id || locations[0]?.id;

        Object.entries(mapping).forEach(([item, locName]) => {
            const foundId = findLocId(locName as string);
            if (foundId) {
                idMap[item] = foundId;
            } else {
                idMap[item] = defaultId;
            }
        });

        // Ensure all items have a mapping (fallback for AI misses)
        itemNames.forEach(name => {
            if (!idMap[name]) idMap[name] = defaultId;
        });

        setLocationMap(idMap);

    } catch (e) {
        console.error("AI Sorting failed", e);
        // Fallback: Everything to Pantry/First location
        const defaultId = locations[0]?.id;
        const fallbackMap: Record<string, string> = {};
        checkedItems.forEach(i => fallbackMap[i.name] = defaultId);
        setLocationMap(fallbackMap);
    } finally {
        setIsSorting(false);
    }
  };

  const handleFinishCheckout = async () => {
    const checkedItems = items.filter(i => i.isChecked);
    const result = await moveShoppingToInventory(userId, checkedItems, locationMap);
    if (result.success) {
        setIsCheckingOut(false);
        // Remove moved items from local state
        setItems(prev => prev.filter(i => !i.isChecked));
        alert("Items moved to Kitchen Inventory!");
    } else {
        alert(`Failed to update inventory: ${result.message}`);
    }
  };

  const updateLocationMap = (itemName: string, locationId: string) => {
      setLocationMap(prev => ({ ...prev, [itemName]: locationId }));
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-lime-500" /></div>;

  // --- CHECKOUT MODAL ---
  if (isCheckingOut) {
      const checkedItems = items.filter(i => i.isChecked);
      
      return (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[85vh]">
                <div className="p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Layers className="w-6 h-6 text-lime-400" />
                        Sorting Groceries
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        We organized your items. Review where they go.
                    </p>
                </div>

                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    {isSorting ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-lime-500" />
                            <p className="text-slate-400 text-sm animate-pulse">AI is organizing your bags...</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {checkedItems.map(item => (
                                <div key={item.id} className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700">
                                    <span className="font-medium text-white">{item.name}</span>
                                    
                                    <select 
                                        value={locationMap[item.name] || ''}
                                        onChange={(e) => updateLocationMap(item.name, e.target.value)}
                                        className="bg-slate-900 border border-slate-600 text-slate-300 text-sm rounded-lg px-2 py-1 outline-none focus:border-lime-500"
                                    >
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-800 bg-slate-900 flex gap-3">
                    <button 
                        onClick={() => setIsCheckingOut(false)}
                        className="flex-1 py-3 text-slate-400 hover:text-white font-medium"
                    >
                        Back
                    </button>
                    <button 
                        onClick={handleFinishCheckout}
                        disabled={isSorting}
                        className="flex-[2] bg-lime-500 hover:bg-lime-400 text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        Confirm & Put Away
                    </button>
                </div>
            </div>
        </div>
      );
  }

  // --- MAIN LIST ---
  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex items-center justify-between mb-6">
        <div>
           <h2 className="text-3xl font-bold text-white flex items-center gap-2">
              <ShoppingCart className="w-8 h-8 text-lime-500" /> Shopping List
           </h2>
           <p className="text-slate-400">Check items off as you shop.</p>
        </div>
        
        {items.some(i => i.isChecked) && (
            <button 
               onClick={handleCheckoutStart}
               className="bg-lime-500 hover:bg-lime-400 text-slate-900 px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition-all"
            >
               Done Shopping <ArrowRight className="w-4 h-4" />
            </button>
        )}
      </div>

      {items.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-700 rounded-2xl">
              <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-white">List is Empty</h3>
              <p className="text-slate-500">Add ingredients from recipes to get started.</p>
          </div>
      ) : (
          <div className="space-y-2">
              {items.map(item => (
                  <div 
                    key={item.id}
                    onClick={() => handleToggle(item.id, item.isChecked)}
                    className={`p-4 rounded-xl border flex items-center gap-4 cursor-pointer transition-all group ${
                        item.isChecked 
                        ? 'bg-lime-900/10 border-lime-500/20 opacity-75' 
                        : 'bg-slate-800 border-slate-700 hover:border-lime-500/50'
                    }`}
                  >
                     <div className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                         item.isChecked 
                         ? 'bg-lime-500 border-lime-500' 
                         : 'border-slate-500 group-hover:border-lime-400'
                     }`}>
                         {item.isChecked && <Check className="w-4 h-4 text-slate-900" />}
                     </div>
                     
                     <span className={`text-lg ${item.isChecked ? 'text-slate-500 line-through' : 'text-white'}`}>
                         {item.name}
                     </span>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};