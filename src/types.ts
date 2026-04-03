export type Category = 'fridge' | 'freezer' | 'pantry' | 'other';
export type ItemStatus = 'available' | 'used' | 'move';

export interface Location {
  id: string;
  name: string;
  image?: string;
  icon?: 'home' | 'holiday' | 'caravan';
}

export interface Item {
  id: string;
  name: string;
  image?: string; // base64 or url
  category: Category;
  locationId: string;
  dateAdded: string;
  expiryDate?: string;
  status: ItemStatus;
  quantity: number;
}

export interface User {
  id: string;
  email: string;
  familyId: string;
}

export const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: 'fridge', label: 'Fridge', icon: '❄️' },
  { value: 'freezer', label: 'Freezer', icon: '🧊' },
  { value: 'pantry', label: 'Pantry', icon: '🍞' },
  { value: 'other', label: 'Other', icon: '📦' },
];

export const QUICK_ADDS = ['Milk', 'Meat', 'Veg', 'Coffee'];

export const COLORS = {
  bg: 'bg-[#fcfcfc]',
  text: 'text-[#1a1a1a]',
  green: '#22c55e',
  yellow: '#facc15',
  red: '#ef4444',
};
