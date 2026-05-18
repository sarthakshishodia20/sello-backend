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
    { key: 'chime', label: 'Chime Ding (Default)', url: 'https://raw.githubusercontent.com/MycroftAI/skill-alarm/18.08/sounds/chimes.mp3' },
    { key: 'bell', label: 'Classic Bell', url: 'https://raw.githubusercontent.com/MycroftAI/skill-alarm/18.08/sounds/bell.mp3' },
    { key: 'bubble', label: 'Bubble Pop', url: 'https://raw.githubusercontent.com/MycroftAI/mycroft-core/master/mycroft/res/snd/start_listening.wav' },
    { key: 'digital', label: 'Digital Beep', url: 'https://raw.githubusercontent.com/MycroftAI/skill-alarm/18.08/sounds/beep4.mp3' },
    { key: 'alarm', label: 'Alert Siren', url: 'https://raw.githubusercontent.com/MycroftAI/skill-alarm/18.08/sounds/constant_beep.mp3' }
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
