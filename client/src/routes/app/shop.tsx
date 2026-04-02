import React from 'react';
import { GlassPanel } from '../../components/GlassPanel';
import { useSettingsStore } from '../../stores/settingsStore';
import { Palette } from 'lucide-react';

const FREE_THEMES = [
  { id: 'space', name: 'Space', note: 'Nebulas and star field' },
  { id: 'ocean', name: 'Ocean', note: 'Soft underwater light' },
  { id: 'aurora', name: 'Aurora', note: 'Northern lights glow' },
  { id: 'matrix', name: 'Matrix', note: 'Digital rain' },
  { id: 'sakura', name: 'Sakura', note: 'Cherry blossom petals' },
  { id: 'deep_sea', name: 'Deep Sea', note: 'Abyssal blue' },
];

export function ShopPage() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [customThemes, setCustomThemes] = React.useState<any[]>([]);

  React.useEffect(() => {
    const loadThemes = () => {
      try {
        setCustomThemes(JSON.parse(localStorage.getItem('raider_theme_shop_customs') || '[]'));
      } catch {
        setCustomThemes([]);
      }
    };

    loadThemes();
    window.addEventListener('storage', loadThemes);
    window.addEventListener('raider-theme-shop-updated', loadThemes as EventListener);
    return () => {
      window.removeEventListener('storage', loadThemes);
      window.removeEventListener('raider-theme-shop-updated', loadThemes as EventListener);
    };
  }, []);

  const applyCustomTheme = (config: any) => {
    localStorage.setItem('raider_custom_theme', JSON.stringify(config));
    window.dispatchEvent(new Event('raider-custom-theme-updated'));
    update({ color_scheme: 'custom_special' });
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Palette size={22} /> Free Theme Shop</h1>
        <p className="text-sm text-gray-400 mt-1">Every theme here is free. Pick one and it applies immediately.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {FREE_THEMES.map((theme) => (
          <GlassPanel key={theme.id} className="p-4 flex flex-col gap-3">
            <div>
              <div className="text-white font-semibold">{theme.name}</div>
              <div className="text-sm text-gray-500 mt-1">{theme.note}</div>
            </div>
            <button
              onClick={() => update({ color_scheme: theme.id })}
              className={`btn ${settings?.color_scheme === theme.id ? 'btn-glass' : 'btn-primary'}`}
            >
              {settings?.color_scheme === theme.id ? 'Active' : 'Apply'}
            </button>
          </GlassPanel>
        ))}

        {customThemes.map((theme) => (
          <GlassPanel key={theme.id} className="p-4 flex flex-col gap-3">
            <div>
              <div className="text-white font-semibold">{theme.name}</div>
              <div className="text-sm text-gray-500 mt-1">Shared custom theme</div>
            </div>
            <button onClick={() => applyCustomTheme(theme.config)} className="btn btn-primary">Apply</button>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}