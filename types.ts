
export enum View {
  Assistant = 'Assistant',
  Images = 'Images',
  Voice = 'Voice',
  Camera = 'Camera',
  ScreenShare = 'ScreenShare',
  VoiceClone = 'VoiceClone',
}

export enum ImageStyle {
  Ghibli = 'Ghibli',
  Realistic = 'Realistic',
  ThreeD = '3D',
}

export enum AspectRatio {
  SixteenNine = '16:9',
  OneOne = '1:1', // Representing "Original"
  NineSixteen = '9:16',
}

export type VoiceGender = 'Male' | 'Female' | 'Cloned';

export interface VoiceOption {
  id: string;
  name: string;
  gender: VoiceGender;
  type: 'prebuilt' | 'cloned';
  fileName?: string;
}

// Centralized voice data for consistency across the application
export const voices: VoiceOption[] = [
  { id: 'Charon', name: 'Voice 1', gender: 'Male', type: 'prebuilt' },
  { id: 'Zephyr', name: 'Voice 2', gender: 'Female', type: 'prebuilt' },
  { id: 'Puck', name: 'Voice 3', gender: 'Male', type: 'prebuilt' },
  { id: 'Fenrir', name: 'Voice 4', gender: 'Male', type: 'prebuilt' },
  { id: 'Kore', name: 'Voice 5', gender: 'Female', type: 'prebuilt' },
];