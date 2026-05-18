import { Injectable } from '@angular/core';

export interface SoundOption {
  key: string;
  label: string;
  url: string;
}

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  public sounds: SoundOption[] = [
    { key: 'chime', label: 'Chime Ding (Default)', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-200.wav' },
    { key: 'bell', label: 'Classic Bell', url: 'https://assets.mixkit.co/active_storage/sfx/911/911-200.wav' },
    { key: 'bubble', label: 'Bubble Pop', url: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-200.wav' },
    { key: 'digital', label: 'Digital Beep', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-200.wav' },
    { key: 'alarm', label: 'Alert Siren', url: 'https://assets.mixkit.co/active_storage/sfx/997/997-200.wav' }
  ];

  play(soundKey: string) {
    if (soundKey === 'disabled') return;

    const sound = this.sounds.find(s => s.key === soundKey) || this.sounds[0];
    if (!sound) return;

    try {
      const audio = new Audio(sound.url);
      audio.load();
      audio.play().catch(err => {
        console.warn('Audio play blocked by browser policy:', err.message);
      });
    } catch (e: any) {
      console.error('Audio service play error:', e.message);
    }
  }
}
