
import React, { useEffect, useState } from 'react';
import { InventoryItem, Location } from '../types';
import { getUserInventory, updateInventoryStatus, getUserLocations, updateInventoryLocation } from '../services/dbService';
import { Archive, Refrigerator, Box, Flame, Search, ToggleLeft, ToggleRight, Loader2, Plus, AlertCircle, IceCream } from 'lucide-react';

interface Props {
  userId: string;
}

export const KitchenManager: React.FC<Props> = ({ userId }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    const [inventoryData, locationsData] = await Promise.all([
      getUserInventory(userId),
      getUserLocations(userId)
    ]);
    setItems(inventoryData);
    setLocations(locationsData);
    setLoading(false);
  };

  const loadInventory = async () => {
    const data = await getUserInventory(userId);
    setItems(data);
  };

  const handleToggle = async (item: InventoryItem) => {
    setProcessingId(item.id);
    const newStatus = !item.inStock;
    
    // Optimistic UI Update
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, inStock: newStatus } : i));
    
    // DB Call
    const success = await updateInventoryStatus(userId, item, newStatus);
    
    if (!success) {
       // Revert on fail
       setItems(prev => prev.map(i => i.id === item.id ? { ...i, inStock: !newStatus } : i));
       alert("Failed to update status. Please check connection.");
    } 
    // We do NOT remove it from the list here anymore. 
    // It remains in the list as "Out of Stock" (Staple Management)
    
    setProcessingId(null);
  };

  const handleLocationChange = async (itemId: string, newLocationId: string) => {
    setProcessingId(itemId);
    
    // Find the new location name
    const newLocationName = newLocationId 
      ? locations.find(l => l.id === newLocationId)?.name || 'Unsorted'
      : 'Unsorted';
    
    // Optimistic UI update
    setItems(prev => prev.map(i => 
      i.id === itemId 
        ? { 
            ...i, 
            locationId: newLocationId || undefined,
            locationName: newLocationName
          } 
        : i
    ));
    
    // Update in database
    const success = await updateInventoryLocation(itemId, newLocationId || null);
    
    if (!success) {
      // Revert on failure
      await loadInventory();
      alert("Failed to update location. Please try again.");
    }
    
    setProcessingId(null);
  };

  const getIconForLocation = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('fridge')) return <Refrigerator className="w-5 h-5 text-cyan-400" />;
    if (n.includes('freezer')) return <IceCream className="w-5 h-5 text-blue-300" />;
    if (n.includes('spice')) return <Flame className="w-5 h-5 text-orange-400" />;
    return <Box className="w-5 h-5 text-amber-600" />;
  };

  // Group items by location
  const groupedItems: Record<string, InventoryItem[]> = {};
  items
    .filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .forEach(i => {
       const loc = i.locationName || 'Unsorted';
       if (!groupedItems[loc]) groupedItems[loc] = [];
       groupedItems[loc].push(i);
    });

  const sortedLocations = Object.keys(groupedItems).sort();

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-lime-500" /></div>;

  return (
    <div className="animate-in fade-in duration-500 pb-20">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
           <div>
               <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                   <Archive className="w-8 h-8 text-lime-500" /> Kitchen Staples
               </h2>
               <p className="text-slate-400">Track what you have. Depleting an item adds it to your Shopping List.</p>
           </div>
           
           <div className="relative w-full md:w-64">
               <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
               <input 
                 type="text" 
                 placeholder="Search pantry..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:border-lime-500 outline-none"
               />
           </div>
       </div>

       {items.length === 0 ? (
           <div className="text-center py-20 border border-dashed border-slate-700 rounded-2xl">
               <Box className="w-16 h-16 text-slate-700 mx-auto mb-4" />
               <h3 className="text-xl font-bold text-white mb-2">Kitchen is Empty</h3>
               <p className="text-slate-500 max-w-sm mx-auto">
                   Go shopping to stock up your pantry and start tracking staples.
               </p>
           </div>
       ) : (
           <div className="space-y-8">
               {sortedLocations.map(location => (
                   <div key={location} className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
                       <div className="bg-slate-900 px-6 py-3 border-b border-slate-800 flex items-center gap-3">
                           {getIconForLocation(location)}
                           <h3 className="text-lg font-bold text-white">{location}</h3>
                           <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                               {groupedItems[location].length} items
                           </span>
                       </div>
                       
                       <div className="divide-y divide-slate-800">
                           {groupedItems[location].map(item => (
                               <div key={item.id} className={`p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors group ${!item.inStock ? 'opacity-50 grayscale hover:opacity-100 hover:grayscale-0' : ''}`}>
                                   <div className="flex-1">
                                       <p className={`font-medium transition-colors ${item.inStock ? 'text-slate-200 group-hover:text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>
                                           {item.name}
                                       </p>
                                       <p className="text-xs text-slate-500">{item.category || 'General'}</p>
                                   </div>
                                   
                                   <div className="flex items-center gap-2 sm:gap-3">
                                       {/* Location Selector */}
                                       <select
                                           value={item.locationId || ''}
                                           onChange={(e) => handleLocationChange(item.id, e.target.value)}
                                           disabled={processingId === item.id}
                                           className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 hover:border-slate-600 focus:border-lime-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                           title="Change storage location"
                                       >
                                           <option value="">Unsorted</option>
                                           {locations.map(loc => (
                                               <option key={loc.id} value={loc.id}>
                                                   {loc.name}
                                               </option>
                                           ))}
                                       </select>
                                       
                                       {!item.inStock && (
                                           <span className="text-[10px] uppercase font-bold text-orange-500 bg-orange-900/20 px-2 py-1 rounded">Out</span>
                                       )}
                                       
                                       <button 
                                          onClick={() => handleToggle(item)}
                                          disabled={processingId === item.id}
                                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                                              item.inStock 
                                              ? 'bg-lime-500/10 border-lime-500/50 text-lime-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50' 
                                              : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-lime-500/10 hover:text-lime-400'
                                          }`}
                                          title={item.inStock ? "Click to Consume (Out of Stock)" : "Restock"}
                                       >
                                           {processingId === item.id ? (
                                               <Loader2 className="w-5 h-5 animate-spin" />
                                           ) : item.inStock ? (
                                               <>
                                                 <span className="text-xs font-bold uppercase mr-1 hidden sm:inline">In Stock</span>
                                                 <ToggleRight className="w-6 h-6" />
                                               </>
                                           ) : (
                                               <ToggleLeft className="w-6 h-6" />
                                           )}
                                       </button>
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
               ))}
           </div>
       )}
    </div>
  );
};
