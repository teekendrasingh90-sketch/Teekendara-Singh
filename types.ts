
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
  { id: 'Charon', name: 'Charon', gender: 'Male' },
  { id: 'Puck', name: 'Puck', gender: 'Male' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'Male' },
  { id: 'Kore', name: 'Kore', gender: 'Female' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'Female' },
];