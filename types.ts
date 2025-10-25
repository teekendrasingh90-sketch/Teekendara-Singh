
export enum View {
  Assistant = 'Assistant',
  Images = 'Images',
  Voice = 'Voice',
  Camera = 'Camera',
  ScreenShare = 'ScreenShare',
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

export type VoiceGender = 'Male' | 'Female';

export interface VoiceOption {
  id: string;
  name: string;
  gender: VoiceGender;
}

// Centralized voice data for consistency across the application
export const voices: VoiceOption[] = [
  { id: 'Charon', name: 'Voice 1', gender: 'Male' },
  { id: 'Zephyr', name: 'Voice 2', gender: 'Female' },
  { id: 'Puck', name: 'Voice 3', gender: 'Male' },
  { id: 'Fenrir', name: 'Voice 4', gender: 'Male' },
  { id: 'Kore', name: 'Voice 5', gender: 'Female' },
];