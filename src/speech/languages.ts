/** Common Whisper multilingual model language codes exposed by Ripple's manual selector. */
export const WHISPER_LANGUAGES = [
  ['en', 'English'],
  ['hi', 'Hindi'],
  ['bn', 'Bengali'],
  ['gu', 'Gujarati'],
  ['kn', 'Kannada'],
  ['ml', 'Malayalam'],
  ['mr', 'Marathi'],
  ['pa', 'Punjabi'],
  ['ta', 'Tamil'],
  ['te', 'Telugu'],
  ['ur', 'Urdu'],
  ['ar', 'Arabic'],
  ['zh', 'Chinese'],
  ['nl', 'Dutch'],
  ['fr', 'French'],
  ['de', 'German'],
  ['el', 'Greek'],
  ['he', 'Hebrew'],
  ['id', 'Indonesian'],
  ['it', 'Italian'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['fa', 'Persian'],
  ['pl', 'Polish'],
  ['pt', 'Portuguese'],
  ['ru', 'Russian'],
  ['es', 'Spanish'],
  ['sv', 'Swedish'],
  ['th', 'Thai'],
  ['tr', 'Turkish'],
  ['uk', 'Ukrainian'],
  ['vi', 'Vietnamese'],
] as const;

export type WhisperLanguageCode = (typeof WHISPER_LANGUAGES)[number][0];

const LANGUAGE_CODES = new Set<string>(WHISPER_LANGUAGES.map(([code]) => code));

export const isWhisperLanguageCode = (value: string): value is WhisperLanguageCode =>
  LANGUAGE_CODES.has(value);
