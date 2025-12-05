
import React, { useState, useEffect } from 'react';
import { Ingredient, AuditItem } from '../types';
import { auditRecipeIngredients, commitShoppingAudit } from '../services/dbService';
import { ShoppingCart, CheckCircle2, X, Loader2, RefreshCw, ChefHat, CheckSquare, Square } from 'lucide-react';

interface Props {
  ingredients: Ingredient[];
  userId: string;
  recipeId?: string;
  onClose: () => void;
}

export const ShoppingAuditModal: React.FC<Props> = ({ ingredients, userId, recipeId, onClose }) => {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    const runAudit = async () => {
      setLoading(true);
      const auditResults = await auditRecipeIngredients(userId, ingredients);
      setItems(auditResults);
      setLoading(false);
    };
    runAudit();
  }, [ingredients, userId]);

  const toggleItem = (index: number) => {
    setItems(prev => {
      const copy = [...prev];
      const oldValue = copy[index].inStock;
      copy[index] = { ...copy[index], inStock: !oldValue };
      return copy;
    });
  };

  const handleConfirm = async () => {
    setCommitting(true);
    await commitShoppingAudit(userId, items, recipeId);
    setCommitting(false);
    onClose();
    alert("Shopping List Updated! Pantry stock updated.");
  };

  const stats = {
    have: items.filter(i => i.inStock).length,
    buy: items.filter(i => !i.inStock).length
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ChefHat className="w-6 h-6 text-lime-400" /> Kitchen Audit
            </h2>
            <p className="text-slate-400 text-sm mt-1">Check off what you already have.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-4 custom-scrollbar bg-slate-950/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-lime-500" />
              <p className="text-sm">Checking your pantry...</p>
            </div>
          ) : (
            <div className="space-y-2">
               {items && items.length > 0 ? items.map((item, idx) => (
                 <div 
                    key={idx}
                    onClick={() => toggleItem(idx)}
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all group ${
                        item.inStock 
                        ? 'bg-slate-800/50 border-lime-500/30' 
                        : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                    }`}
                 >
                    <div className="flex items-center gap-4">
                        <div className={`transition-colors ${item.inStock ? 'text-lime-400' : 'text-slate-600 group-hover:text-slate-400'}`}>
                            {item.inStock ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                        </div>
                        <div>
                            <p className={`font-medium ${item.inStock ? 'text-slate-300 line-through decoration-slate-600' : 'text-white'}`}>
                                {item.name}
                            </p>
                            <p className="text-xs text-slate-500">
                                {item.qty} {item.unit}
                            </p>
                        </div>
                    </div>
                    
                    <div className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${
                        item.inStock 
                        ? 'bg-lime-900/20 text-lime-500' 
                        : 'bg-orange-900/20 text-orange-500'
                    }`}>
                        {item.inStock ? 'Have it' : 'To Buy'}
                    </div>
                 </div>
               )) : <p className="text-slate-400 text-center py-8">No items to display</p>}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-900">
           <div className="flex justify-between items-center text-sm text-slate-400 mb-4 px-1">
               <span>Pantry: <strong className="text-lime-400">{stats.have}</strong> items</span>
               <span>Shopping List: <strong className="text-orange-400">{stats.buy}</strong> items</span>
           </div>

           <button 
              onClick={handleConfirm}
              disabled={loading || committing}
              className="w-full bg-lime-500 hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
           >
              {committing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Updating List...
                  </>
              ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" /> Update Shopping List
                  </>
              )}
           </button>
        </div>
      </div>
    </div>
  );
};
