
export enum View {
  Assistant = 'Assistant',
  Images = 'Images',
  Thumbnail = 'Thumbnail',
  // FIX: Add Video view to enable video generator functionality.
  Video = 'Video',
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