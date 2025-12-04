import { chefRegistry } from '../../services/chef/ChefRegistry';
import type { ChefPersona } from '../../services/chef/chefPersonas';
import { ChefHat } from 'lucide-react';

interface ChefSelectorProps {
  onSelectChef: (chef: ChefPersona) => void;
  selectedChefId?: string;
}

export function ChefSelector({ onSelectChef, selectedChefId }: ChefSelectorProps) {
  const chefs = chefRegistry.getAllChefs();

  if (chefs.length === 0) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <p className="text-yellow-400 text-sm">
          ⚠️ No AI chefs available. Check that VITE_GEMINI_API_KEY is configured.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ChefHat className="w-5 h-5 text-lime-400" />
        <h3 className="text-lg font-semibold text-white">Choose Your AI Chef</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {chefs.map((chef) => (
          <button
            key={chef.id}
            onClick={() => onSelectChef(chef)}
            className={`
              p-4 rounded-lg border-2 text-left transition-all
              ${
                selectedChefId === chef.id
                  ? 'border-lime-500 bg-lime-500/10 shadow-lg'
                  : 'border-slate-700 bg-slate-800 hover:border-lime-400 hover:bg-slate-700'
              }
            `}
          >
            <div className="font-semibold text-lg mb-1 text-white">{chef.name}</div>
            <div className="text-sm text-slate-300 mb-2">{chef.description}</div>
            <div className="text-xs text-slate-500">{chef.specialization}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

