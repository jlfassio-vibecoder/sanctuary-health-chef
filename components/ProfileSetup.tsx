
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { User, ChefHat, AlertCircle, Save, Scale, UtensilsCrossed, Settings } from 'lucide-react';

interface Props {
  profile: UserProfile;
  onSave: (p: UserProfile) => void;
}

export const ProfileSetup: React.FC<Props> = ({ profile, onSave }) => {
  const [localProfile, setLocalProfile] = useState<UserProfile>(profile);
  // Maintain raw string state for array inputs
  const [rawGoals, setRawGoals] = useState(profile.goals.join(', '));
  const [rawInjuries, setRawInjuries] = useState(profile.injuries.join(', '));
  const [rawMedical, setRawMedical] = useState(profile.medicalConditions.join(', '));
  const [rawPreferences, setRawPreferences] = useState(profile.preferences.join(', '));
  
  const [isOpen, setIsOpen] = useState(false);

  // Sync props to state if props change (e.g. data loaded from DB)
  useEffect(() => {
    setLocalProfile(profile);
    setRawGoals(profile.goals.join(', '));
    setRawInjuries(profile.injuries.join(', '));
    setRawMedical(profile.medicalConditions.join(', '));
    setRawPreferences(profile.preferences.join(', '));
  }, [profile]);

  const handleChange = (field: keyof UserProfile, value: any) => {
    setLocalProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Parse raw strings into arrays upon saving
    const finalProfile: UserProfile = {
      ...localProfile,
      goals: rawGoals.split(',').map(s => s.trim()).filter(s => s.length > 0),
      injuries: rawInjuries.split(',').map(s => s.trim()).filter(s => s.length > 0),
      medicalConditions: rawMedical.split(',').map(s => s.trim()).filter(s => s.length > 0),
      preferences: rawPreferences.split(',').map(s => s.trim()).filter(s => s.length > 0)
    };
    onSave(finalProfile);
    setIsOpen(false);
  };

  const toggleUnits = () => {
    const isStandard = localProfile.units === 'standard';
    const newUnit = isStandard ? 'metric' : 'standard';
    
    let newWeight = localProfile.weight;
    let newHeight = localProfile.height;

    if (isStandard) {
        newWeight = Math.round(newWeight / 2.20462);
        newHeight = Math.round(newHeight * 2.54);
    } else {
        newWeight = Math.round(newWeight * 2.20462);
        newHeight = Math.round(newHeight / 2.54);
    }

    setLocalProfile(prev => ({ 
        ...prev, 
        units: newUnit,
        weight: newWeight,
        height: newHeight
    }));
  };

  const getFeet = () => Math.floor(localProfile.height / 12);
  const getInches = () => localProfile.height % 12;

  const handleHeightStandardChange = (type: 'ft' | 'in', val: number) => {
    const currentFeet = getFeet();
    const currentInches = getInches();
    let totalInches = 0;

    if (type === 'ft') {
        totalInches = (val * 12) + currentInches;
    } else {
        totalInches = (currentFeet * 12) + val;
    }
    handleChange('height', totalInches);
  };

  if (!isOpen) {
    return (
      <div className="bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-[#f0dc7a] rounded-full">
            <ChefHat className="text-slate-900 w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white">Diner Profile</h3>
            <p className="text-slate-400 text-sm">
                {localProfile.age}yo • {localProfile.fitnessLevel} Cook
            </p>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 text-sm text-[#f0dc7a] hover:text-[#f4e59c] font-medium transition-colors"
        >
          Edit Profile
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-[#f0dc7a]" /> Edit Dietary Profile
        </h3>
        
        <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-700">
            <button 
                onClick={() => localProfile.units !== 'standard' && toggleUnits()}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    localProfile.units === 'standard' 
                    ? 'bg-[#f0dc7a] text-slate-900 shadow' 
                    : 'text-slate-400 hover:text-white'
                }`}
            >
                Imperial
            </button>
            <button 
                onClick={() => localProfile.units !== 'metric' && toggleUnits()}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    localProfile.units === 'metric' 
                    ? 'bg-[#f0dc7a] text-slate-900 shadow' 
                    : 'text-slate-400 hover:text-white'
                }`}
            >
                Metric
            </button>
        </div>
      </div>
      
      {/* Vitals Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-slate-400 text-xs uppercase mb-1">Age</label>
          <input 
            type="number" 
            value={localProfile.age} 
            onChange={(e) => handleChange('age', parseInt(e.target.value))}
            className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 focus:border-[#f0dc7a] outline-none"
          />
        </div>
        
        <div>
          <label className="block text-slate-400 text-xs uppercase mb-1">Gender</label>
          <select 
            value={localProfile.gender}
            onChange={(e) => handleChange('gender', e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 focus:border-[#f0dc7a] outline-none"
          >
            <option>Male</option>
            <option>Female</option>
            <option>Non-Binary</option>
            <option>Prefer not to say</option>
          </select>
        </div>
        
        <div>
          <label className="block text-slate-400 text-xs uppercase mb-1">
            Weight (for calories)
          </label>
          <input 
            type="number" 
            value={localProfile.weight} 
            onChange={(e) => handleChange('weight', parseInt(e.target.value))}
            className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 focus:border-[#f0dc7a] outline-none"
          />
        </div>

        <div>
          <label className="block text-slate-400 text-xs uppercase mb-1">
            Height (for calories)
          </label>
          {localProfile.units === 'standard' ? (
             <div className="flex gap-2">
                <input 
                    type="number" 
                    placeholder="ft"
                    value={getFeet()} 
                    onChange={(e) => handleHeightStandardChange('ft', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 focus:border-[#f0dc7a] outline-none text-center"
                />
                <input 
                    type="number" 
                    placeholder="in"
                    value={getInches()} 
                    onChange={(e) => handleHeightStandardChange('in', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 focus:border-[#f0dc7a] outline-none text-center"
                />
             </div>
          ) : (
            <input 
                type="number" 
                value={localProfile.height} 
                onChange={(e) => handleChange('height', parseInt(e.target.value))}
                className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 focus:border-[#f0dc7a] outline-none"
            />
          )}
        </div>
      </div>

      <div className="mb-4">
          <label className="block text-slate-400 text-xs uppercase mb-1">Cooking Skill Level</label>
          <select 
            value={localProfile.fitnessLevel}
            onChange={(e) => handleChange('fitnessLevel', e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 focus:border-[#f0dc7a] outline-none"
          >
            <option>Beginner (Toast is hard)</option>
            <option>Intermediate (Can follow recipes)</option>
            <option>Advanced (Comfortable improvising)</option>
            <option>Elite (Professional Chef)</option>
          </select>
      </div>

      {/* Array Inputs */}
      <div className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs uppercase mb-1 flex items-center gap-1">
               <Scale className="w-3 h-3 text-[#f0dc7a]" /> Body Goals (comma separated)
            </label>
            <input 
              type="text" 
              value={rawGoals} 
              onChange={(e) => setRawGoals(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 focus:border-[#f0dc7a] outline-none"
              placeholder="e.g. Muscle Gain, Fat Loss, Maintenance"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-xs uppercase mb-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-red-400" /> Allergies (comma separated)
            </label>
            <input 
              type="text" 
              value={rawInjuries} 
              onChange={(e) => setRawInjuries(e.target.value)}
              className="w-full bg-slate-900 border border-red-900/50 text-white rounded p-2 focus:border-red-500 outline-none placeholder-slate-600"
              placeholder="e.g. Peanuts, Shellfish, Gluten"
            />
          </div>
          
          <div>
            <label className="block text-slate-400 text-xs uppercase mb-1 flex items-center gap-1">
               <UtensilsCrossed className="w-3 h-3 text-blue-400" /> Dietary Restrictions (comma separated)
            </label>
            <input 
              type="text" 
              value={rawMedical} 
              onChange={(e) => setRawMedical(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 focus:border-[#f0dc7a] outline-none"
              placeholder="e.g. Vegan, Keto, Paleo"
            />
          </div>
          
          <div>
            <label className="block text-slate-400 text-xs uppercase mb-1 flex items-center gap-1">
               <Settings className="w-3 h-3 text-orange-400" /> Dislikes / Equipment (comma separated)
            </label>
            <input 
              type="text" 
              value={rawPreferences} 
              onChange={(e) => setRawPreferences(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 focus:border-[#f0dc7a] outline-none"
              placeholder="e.g. No Cilantro, Air Fryer, Blender"
            />
          </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 border-t border-slate-700 pt-6">
        <button 
          onClick={() => {
              setIsOpen(false);
              setLocalProfile(profile);
              setRawGoals(profile.goals.join(', '));
              setRawInjuries(profile.injuries.join(', '));
              setRawMedical(profile.medicalConditions.join(', '));
              setRawPreferences(profile.preferences.join(', '));
          }}
          className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={handleSave}
          className="bg-[#f0dc7a] hover:bg-[#f4e59c] text-slate-900 px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
        >
          <Save className="w-4 h-4" /> Save Profile
        </button>
      </div>
    </div>
  );
};