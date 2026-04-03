/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Camera, 
  ChevronLeft, 
  X, 
  Trash2, 
  ArrowRightLeft, 
  Check, 
  Clock, 
  AlertCircle,
  Home,
  LogOut,
  Image as ImageIcon,
  Loader2,
  Settings as SettingsIcon,
  Palmtree,
  Truck
} from 'lucide-react';
import { Item, Location, Category, CATEGORIES, COLORS } from './types';
import { identifyItem } from './services/gemini';
import { AuthScreen } from './components/AuthScreen';

const DEFAULT_LOCATIONS: Location[] = [
  { id: 'main', name: 'Main Home', icon: 'home' },
  { id: 'holiday', name: 'Holiday Home', icon: 'holiday' },
];

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('dualnest-token'));
  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>(DEFAULT_LOCATIONS);
  const [currentView, setCurrentView] = useState<'dashboard' | 'location' | 'leaving' | 'settings'>('dashboard');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/data', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setItems(data.items);
        if (data.locations.length > 0) {
          setLocations(data.locations);
        }
      } else if (response.status === 401) {
        handleLogout();
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = (newToken: string, newUser: any) => {
    localStorage.setItem('dualnest-token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('dualnest-token');
    setToken(null);
    setUser(null);
    setItems([]);
    setLocations(DEFAULT_LOCATIONS);
    setCurrentView('dashboard');
  };

  const syncItem = async (item: Item) => {
    try {
      await fetch('/api/items', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(item),
      });
    } catch (error) {
      console.error('Failed to sync item:', error);
    }
  };

  const syncLocation = async (loc: Location) => {
    try {
      await fetch('/api/locations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(loc),
      });
    } catch (error) {
      console.error('Failed to sync location:', error);
    }
  };

  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return 'fresh';
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 2) return 'expired';
    if (diffDays <= 5) return 'expiring';
    return 'fresh';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'expired': return COLORS.red;
      case 'expiring': return COLORS.yellow;
      default: return COLORS.green;
    }
  };

  const dashboardData = useMemo(() => {
    return locations.map(loc => {
      const locItems = items.filter(i => i.locationId === loc.id && i.status !== 'used');
      const expiring = locItems
        .filter(i => getExpiryStatus(i.expiryDate) !== 'fresh')
        .sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''))
        .slice(0, 3);
      const recent = [...locItems]
        .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))
        .slice(0, 3);

      return {
        ...loc,
        count: locItems.length,
        expiring,
        recent
      };
    });
  }, [items, locations]);
  const handleAddItem = (newItem: Omit<Item, 'id' | 'dateAdded' | 'status'>) => {
    const item: Item = {
      ...newItem,
      id: Math.random().toString(36).substr(2, 9),
      dateAdded: new Date().toISOString(),
      status: 'available',
      quantity: (newItem as any).quantity || 1
    };
    const newItems = [...items, item];
    setItems(newItems);
    syncItem(item);
    setIsAddingItem(false);
  };

  const handleUpdateItem = (updatedItem: Item) => {
    setItems(items.map(i => i.id === updatedItem.id ? updatedItem : i));
    syncItem(updatedItem);
    setSelectedItem(null);
  };

  const handleDeleteItem = async (id: string) => {
    setItems(items.filter(i => i.id !== id));
    setSelectedItem(null);
    try {
      await fetch(`/api/items/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const handleMoveItem = (item: Item) => {
    const otherLocId = locations.find(l => l.id !== item.locationId)?.id;
    if (otherLocId) {
      handleUpdateItem({ ...item, locationId: otherLocId });
    }
  };

  const handleUpdateLocation = (updatedLoc: Location) => {
    setLocations(locations.map(l => l.id === updatedLoc.id ? updatedLoc : l));
    syncLocation(updatedLoc);
  };

  if (!token) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  if (isLoading && items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-300" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-md mx-auto relative overflow-hidden flex flex-col">
      <AnimatePresence mode="wait">
        {currentView === 'dashboard' && (
          <Dashboard 
            data={dashboardData} 
            movingItems={items.filter(i => i.status === 'move')}
            onCompleteMove={(item) => {
              const otherLocId = locations.find(l => l.id !== item.locationId)?.id;
              if (otherLocId) {
                handleUpdateItem({ ...item, locationId: otherLocId, status: 'available' });
              }
            }}
            onSelectLocation={(id) => {
              setSelectedLocationId(id);
              setCurrentView('location');
            }} 
            onOpenSettings={() => setCurrentView('settings')}
            onLogout={handleLogout}
          />
        )}

        {currentView === 'location' && selectedLocationId && (
          <LocationInventory 
            location={locations.find(l => l.id === selectedLocationId)!}
            items={items.filter(i => i.locationId === selectedLocationId && i.status !== 'used')}
            onBack={() => setCurrentView('dashboard')}
            onAddItem={() => setIsAddingItem(true)}
            onSelectItem={setSelectedItem}
            onLeaving={() => setCurrentView('leaving')}
            getExpiryStatus={getExpiryStatus}
            getStatusColor={getStatusColor}
          />
        )}

        {currentView === 'leaving' && selectedLocationId && (
          <LeavingMode 
            locationId={selectedLocationId}
            items={items}
            otherLocationId={locations.find(l => l.id !== selectedLocationId)?.id || ''}
            onBack={() => setCurrentView('location')}
            onUpdateItems={(newItems) => {
              setItems(newItems);
              // In a real app, we'd sync all changed items
            }}
            getExpiryStatus={getExpiryStatus}
          />
        )}

        {currentView === 'settings' && (
          <SettingsView 
            locations={locations}
            onUpdateLocation={handleUpdateLocation}
            onBack={() => setCurrentView('dashboard')}
            token={token!}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingItem && selectedLocationId && (
          <AddItemModal 
            locationId={selectedLocationId}
            onClose={() => setIsAddingItem(false)}
            onSave={handleAddItem}
          />
        )}

        {selectedItem && (
          <ItemDetailModal 
            item={selectedItem}
            locations={locations}
            onClose={() => setSelectedItem(null)}
            onUpdate={handleUpdateItem}
            onDelete={handleDeleteItem}
            onMove={handleMoveItem}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Components ---

function Dashboard({ data, movingItems, onCompleteMove, onSelectLocation, onOpenSettings, onLogout }: { 
  data: any[], 
  movingItems: Item[],
  onCompleteMove: (item: Item) => void,
  onSelectLocation: (id: string) => void,
  onOpenSettings: () => void,
  onLogout: () => void
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-6 space-y-8"
    >
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DualNest</h1>
          <p className="text-gray-500 mt-1">Manage your homes effortlessly.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onOpenSettings}
            className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-95 transition-transform"
          >
            <SettingsIcon size={20} className="text-gray-400" />
          </button>
          <button 
            onClick={onLogout}
            className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-95 transition-transform"
          >
            <LogOut size={20} className="text-red-400" />
          </button>
        </div>
      </header>

      {movingItems.length > 0 && (
        <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 space-y-4">
          <div className="flex items-center gap-2 text-orange-600">
            <ArrowRightLeft size={20} />
            <h2 className="font-bold uppercase tracking-widest text-sm">To Take Next Time</h2>
          </div>
          <div className="space-y-3">
            {movingItems.map((item) => (
              <div key={item.id} className="bg-white p-3 rounded-2xl shadow-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">
                        {CATEGORIES.find(c => c.value === item.category)?.icon}
                      </div>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-sm truncate">{item.name}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{item.category}</p>
                  </div>
                </div>
                <button 
                  onClick={() => onCompleteMove(item)}
                  className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center border border-orange-200"
                >
                  <Check size={20} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {data.map((loc) => (
          <motion.button
            key={loc.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectLocation(loc.id)}
            className="w-full text-left bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col space-y-4 overflow-hidden relative"
          >
            {loc.image && (
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <img src={loc.image} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            
            <div className="flex justify-between items-start relative z-10">
              <div>
                <h2 className="text-xl font-bold">{loc.name}</h2>
                <p className="text-sm text-gray-500 font-medium">{loc.count} items</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-2xl">
                {loc.icon === 'holiday' ? <Palmtree size={24} className="text-gray-400" /> : 
                 loc.icon === 'caravan' ? <Truck size={24} className="text-gray-400" /> :
                 <Home size={24} className="text-gray-400" />}
              </div>
            </div>

            {loc.expiring.length > 0 && (
              <div className="space-y-2 relative z-10">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Expiring Soon</p>
                <div className="flex gap-2">
                  {loc.expiring.map((item: any) => (
                    <div key={item.id} className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center border border-red-100">
                      <span className="text-lg">⚠️</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 relative z-10">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recently Added</p>
              <div className="flex -space-x-2">
                {loc.recent.map((item: any) => (
                  <div key={item.id} className="w-10 h-10 rounded-full border-2 border-white bg-gray-100 overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">
                        {CATEGORIES.find(c => c.value === item.category)?.icon}
                      </div>
                    )}
                  </div>
                ))}
                {loc.count > 3 && (
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-50 flex items-center justify-center text-xs font-bold text-gray-400">
                    +{loc.count - 3}
                  </div>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}


function LocationInventory({ 
  location, 
  items, 
  onBack, 
  onAddItem, 
  onSelectItem, 
  onLeaving,
  getExpiryStatus,
  getStatusColor
}: { 
  location: Location, 
  items: Item[], 
  onBack: () => void, 
  onAddItem: () => void,
  onSelectItem: (item: Item) => void,
  onLeaving: () => void,
  getExpiryStatus: (date?: string) => string,
  getStatusColor: (status: string) => string
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex flex-col h-screen"
    >
      <header className="p-6 flex items-center justify-between sticky top-0 bg-[#fcfcfc] z-10">
        <button onClick={onBack} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">{location.name}</h1>
        <button onClick={onLeaving} className="text-sm font-bold text-red-500 flex items-center gap-1">
          <LogOut size={16} />
          Leaving
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-24">
        <div className="grid grid-cols-2 gap-4">
          {items.map((item) => {
            const status = getExpiryStatus(item.expiryDate);
            const color = getStatusColor(status);
            
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelectItem(item)}
                className="bg-white rounded-3xl p-2 shadow-sm border border-gray-100 overflow-hidden flex flex-col"
              >
                <div className="aspect-square rounded-2xl bg-gray-50 overflow-hidden relative">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      {CATEGORIES.find(c => c.value === item.category)?.icon}
                    </div>
                  )}
                  <div 
                    className="absolute top-2 right-2 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                </div>
                <div className="p-2 text-left">
                  <div className="flex justify-between items-start gap-1">
                    <p className="font-bold text-sm truncate">{item.name}</p>
                    {item.quantity > 1 && (
                      <span className="bg-black text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                        {item.quantity}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    {item.category}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Plus size={32} />
            </div>
            <p className="font-medium">No items yet</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-8 left-0 right-0 px-6 flex justify-center pointer-events-none">
        <button 
          onClick={onAddItem}
          className="bg-black text-white px-8 py-4 rounded-full font-bold shadow-xl flex items-center gap-2 pointer-events-auto active:scale-95 transition-transform"
        >
          <Plus size={20} />
          Add Item
        </button>
      </div>
    </motion.div>
  );
}

function AddItemModal({ locationId, onClose, onSave }: { locationId: string, onClose: () => void, onSave: (item: any) => void }) {
  const [step, setStep] = useState(1);
  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('pantry');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setImage(base64);
        setStep(2);
        setIsIdentifying(true);
        const identifiedName = await identifyItem(base64);
        setName(identifiedName);
        setIsIdentifying(false);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end"
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white w-full rounded-t-[40px] p-8 pb-12 max-w-md mx-auto"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold">Add Item</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square bg-gray-50 rounded-3xl flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 active:bg-gray-100 transition-colors"
              >
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                  <Camera size={24} className="text-gray-400" />
                </div>
                <span className="font-bold text-sm text-gray-500">Take Photo</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageUpload} 
              />
              <button 
                onClick={() => setStep(2)}
                className="aspect-square bg-gray-50 rounded-3xl flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 active:bg-gray-100 transition-colors"
              >
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                  <Plus size={24} className="text-gray-400" />
                </div>
                <span className="font-bold text-sm text-gray-500">Manual Entry</span>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            {image && (
              <div className="aspect-video rounded-3xl overflow-hidden bg-gray-100 relative">
                <img src={image} alt="" className="w-full h-full object-cover" />
                {isIdentifying && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <Loader2 className="animate-spin text-white" />
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Item Name</label>
              <input 
                autoFocus
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What is this?"
                className="w-full bg-gray-50 p-4 rounded-2xl font-bold text-lg focus:outline-none focus:ring-2 focus:ring-black/5"
              />
            </div>
            <button 
              disabled={!name}
              onClick={() => setStep(3)}
              className="w-full bg-black text-white py-5 rounded-2xl font-bold disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Category</p>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map(c => (
                  <button 
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={`p-4 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all ${
                      category === c.value ? 'bg-black text-white shadow-lg' : 'bg-gray-50 text-gray-500'
                    }`}
                  >
                    <span className="text-xl">{c.icon}</span>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Expiry Date (Optional)</p>
              <input 
                type="date" 
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-gray-50 p-4 rounded-2xl font-bold focus:outline-none"
              />
            </div>

            <div className="space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Quantity</p>
              <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl w-fit">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center font-bold text-xl"
                >
                  -
                </button>
                <span className="w-8 text-center font-bold text-lg">{quantity}</span>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center font-bold text-xl"
                >
                  +
                </button>
              </div>
            </div>

            <button 
              onClick={() => onSave({ name, image, category, locationId, expiryDate, quantity })}
              className="w-full bg-black text-white py-5 rounded-2xl font-bold shadow-xl"
            >
              Save Item
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function ItemDetailModal({ item, locations, onClose, onUpdate, onDelete, onMove }: { 
  item: Item, 
  locations: Location[], 
  onClose: () => void, 
  onUpdate: (item: Item) => void,
  onDelete: (id: string) => void,
  onMove: (item: Item) => void
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end"
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white w-full rounded-t-[40px] p-8 pb-12 max-w-md mx-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold truncate pr-4">{item.name}</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-8">
          <div className="aspect-video rounded-3xl overflow-hidden bg-gray-50">
            {item.image ? (
              <img src={item.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl">
                {CATEGORIES.find(c => c.value === item.category)?.icon}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-2xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Location</p>
              <p className="font-bold text-sm">{locations.find(l => l.id === item.locationId)?.name}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Expiry</p>
              <p className="font-bold text-sm">{item.expiryDate || 'No expiry'}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-gray-50 p-4 rounded-2xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Quantity</p>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => onUpdate({ ...item, quantity: Math.max(1, (item.quantity || 1) - 1) })}
                  className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center font-bold"
                >
                  -
                </button>
                <span className="font-bold text-sm">{item.quantity || 1}</span>
                <button 
                  onClick={() => onUpdate({ ...item, quantity: (item.quantity || 1) + 1 })}
                  className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <button 
              onClick={() => onUpdate({ ...item, status: 'used' })}
              className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
            >
              <Check size={20} />
              Mark as Used
            </button>
            <button 
              onClick={() => onUpdate({ ...item, status: 'move' })}
              className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
            >
              <ArrowRightLeft size={20} />
              Remind to Take Next Time
            </button>
            <button 
              onClick={() => onMove(item)}
              className="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
            >
              <ArrowRightLeft size={20} />
              Move Instantly
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => onDelete(item.id)}
                className="bg-red-50 text-red-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                Delete
              </button>
              <button 
                onClick={onClose}
                className="bg-gray-50 text-gray-500 py-4 rounded-2xl font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LeavingMode({ 
  locationId, 
  items, 
  otherLocationId,
  onBack, 
  onUpdateItems,
  getExpiryStatus
}: { 
  locationId: string, 
  items: Item[], 
  otherLocationId: string,
  onBack: () => void, 
  onUpdateItems: (items: Item[]) => void,
  getExpiryStatus: (date?: string) => string
}) {
  const locItems = items.filter(i => i.locationId === locationId && i.status !== 'used');
  const otherLocItems = items.filter(i => i.locationId === otherLocationId && i.status !== 'used');

  const expiringSoon = locItems.filter(i => getExpiryStatus(i.expiryDate) !== 'fresh');
  const considerTaking = locItems.filter(i => !otherLocItems.some(oi => oi.name.toLowerCase() === i.name.toLowerCase()));
  const duplicates = locItems.filter(i => otherLocItems.some(oi => oi.name.toLowerCase() === i.name.toLowerCase()));

  const handleTakeItem = (item: Item) => {
    if (otherLocationId) {
      onUpdateItems(items.map(i => i.id === item.id ? { ...i, locationId: otherLocationId } : i));
    }
  };

  const handleMarkUsed = (item: Item) => {
    onUpdateItems(items.map(i => i.id === item.id ? { ...i, status: 'used' } : i));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col h-screen bg-red-50/30"
    >
      <header className="p-6 flex items-center gap-4 sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-red-100">
        <button onClick={onBack} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Leaving Checklist</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-24">
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-red-500">
            <Clock size={18} />
            <h2 className="font-bold uppercase text-xs tracking-widest">Expiring Soon</h2>
          </div>
          <div className="space-y-3">
            {expiringSoon.map(item => (
              <ChecklistItem key={item.id} item={item} onTake={() => handleTakeItem(item)} onUsed={() => handleMarkUsed(item)} />
            ))}
            {expiringSoon.length === 0 && <p className="text-sm text-gray-400 italic">No items expiring soon.</p>}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-blue-500">
            <ArrowRightLeft size={18} />
            <h2 className="font-bold uppercase text-xs tracking-widest">Consider Taking</h2>
          </div>
          <div className="space-y-3">
            {considerTaking.map(item => (
              <ChecklistItem key={item.id} item={item} onTake={() => handleTakeItem(item)} onUsed={() => handleMarkUsed(item)} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-gray-400">
            <AlertCircle size={18} />
            <h2 className="font-bold uppercase text-xs tracking-widest">Duplicates (Already at other home)</h2>
          </div>
          <div className="space-y-3">
            {duplicates.map(item => (
              <ChecklistItem key={item.id} item={item} onTake={() => handleTakeItem(item)} onUsed={() => handleMarkUsed(item)} />
            ))}
          </div>
        </section>
      </div>

      <div className="fixed bottom-8 left-0 right-0 px-6 flex justify-center pointer-events-none">
        <button 
          onClick={onBack}
          className="bg-black text-white px-12 py-4 rounded-full font-bold shadow-xl pointer-events-auto active:scale-95 transition-transform"
        >
          Done
        </button>
      </div>
    </motion.div>
  );
}
function SettingsView({ locations, onUpdateLocation, onBack, token }: { 
  locations: Location[]; 
  onUpdateLocation: (loc: Location) => void; 
  onBack: () => void; 
  token: string;
}) {
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{text: string, isError: boolean} | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setInviteMessage(null);
    try {
      const response = await fetch('/api/family/invite', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await response.json();
      if (response.ok) {
        setInviteMessage({ text: `Invited ${inviteEmail}!`, isError: false });
        setInviteEmail('');
      } else {
        setInviteMessage({ text: data.error || 'Failed to invite', isError: true });
      }
    } catch (err) {
      setInviteMessage({ text: 'Error sending invite', isError: true });
    } finally {
      setIsInviting(false);
      setTimeout(() => setInviteMessage(null), 3000);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="flex flex-col h-screen"
    >
      <header className="p-6 flex items-center gap-4 sticky top-0 bg-[#fcfcfc] z-10">
        <button onClick={onBack} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <section className="space-y-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Manage Locations</h2>
          <div className="space-y-4">
            {locations.map(loc => (
              <button 
                key={loc.id}
                onClick={() => setEditingLoc(loc)}
                className="w-full bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden">
                    {loc.image ? (
                      <img src={loc.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      loc.icon === 'holiday' ? <Palmtree className="text-gray-400" /> : 
                      loc.icon === 'caravan' ? <Truck className="text-gray-400" /> :
                      <Home className="text-gray-400" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-bold">{loc.name}</p>
                    <p className="text-xs text-gray-400 font-medium">Tap to edit</p>
                  </div>
                </div>
                <ChevronLeft size={20} className="text-gray-300 rotate-180" />
              </button>
            ))}
          </div>
        </section>
        <section className="space-y-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Family Sharing</h2>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4 text-left">
            <p className="text-sm text-gray-500 font-bold leading-relaxed">
              Share your homes with family. Enter their email to join your profiles.
            </p>
            <form onSubmit={handleInvite} className="space-y-3 font-bold">
              <input 
                type="email" 
                required
                placeholder="family-member@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full bg-gray-50 p-4 rounded-2xl font-bold text-sm focus:outline-none"
              />
              <button 
                type="submit"
                disabled={isInviting || !inviteEmail}
                className="w-full bg-black text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
              >
                {isInviting ? <Loader2 size={18} className="animate-spin" /> : 'Invite Member'}
              </button>
            </form>
            {inviteMessage && (
              <p className={`text-center text-[10px] font-bold uppercase tracking-wider ${inviteMessage.isError ? 'text-red-500' : 'text-green-500'}`}>
                {inviteMessage.text}
              </p>
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {editingLoc && (
          <EditLocationModal 
            location={editingLoc}
            onClose={() => setEditingLoc(null)}
            onSave={(updated) => {
              onUpdateLocation(updated);
              setEditingLoc(null);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EditLocationModal({ location, onClose, onSave }: { 
  location: Location, 
  onClose: () => void, 
  onSave: (loc: Location) => void 
}) {
  const [name, setName] = useState(location.name);
  const [icon, setIcon] = useState(location.icon || 'home');
  const [image, setImage] = useState(location.image || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end"
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="bg-white w-full rounded-t-[40px] p-8 pb-12 max-w-md mx-auto"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold">Edit Location</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-8">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Location Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 p-4 rounded-2xl font-bold text-lg focus:outline-none"
            />
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Thumbnail</p>
            <div className="flex gap-4 items-center">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden"
              >
                {image ? (
                  <img src={image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={24} className="text-gray-300" />
                )}
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
              {image && (
                <button onClick={() => setImage(null)} className="text-xs font-bold text-red-500">Remove Photo</button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Default Icon</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'home', icon: <Home size={20} />, label: 'Home' },
                { id: 'holiday', icon: <Palmtree size={20} />, label: 'Holiday' },
                { id: 'caravan', icon: <Truck size={20} />, label: 'Caravan' },
              ].map(item => (
                <button 
                  key={item.id}
                  onClick={() => setIcon(item.id as any)}
                  className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all ${
                    icon === item.id ? 'bg-black text-white shadow-lg' : 'bg-gray-50 text-gray-400'
                  }`}
                >
                  {item.icon}
                  <span className="text-[10px] font-bold uppercase">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={() => onSave({ ...location, name, icon, image: image || undefined })}
            className="w-full bg-black text-white py-5 rounded-2xl font-bold shadow-xl"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ChecklistItem({ item, onTake, onUsed }: { item: Item, onTake: () => void, onUsed: () => void, key?: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-10 h-10 rounded-xl bg-gray-50 flex-shrink-0 overflow-hidden">
          {item.image ? (
            <img src={item.image} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl">
              {CATEGORIES.find(c => c.value === item.category)?.icon}
            </div>
          )}
        </div>
        <div className="overflow-hidden">
          <div className="flex items-center gap-2 max-w-full">
            <p className="font-bold text-sm truncate">{item.name}</p>
            {item.quantity > 1 && (
              <span className="bg-black text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {item.quantity}
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{item.category}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onUsed} className="p-2 bg-green-50 text-green-600 rounded-xl">
          <Check size={18} />
        </button>
        <button onClick={onTake} className="p-2 bg-blue-50 text-blue-600 rounded-xl">
          <ArrowRightLeft size={18} />
        </button>
      </div>
    </div>
  );
}
