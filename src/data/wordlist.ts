// A tiny fixed sample wordlist, purely for demonstrating *how* a dictionary
// attack works. This never touches a network or a real capture file.
export const SAMPLE_WORDLIST: string[] = [
  '123456789',
  'password1',
  'letmein1',
  'qwertyuiop',
  'iloveyou1',
  'sunshine1',
  'football1',
  'dragon123',
  'monkey123',
  'homenet2024',
  'trustno1!',
  'summer2024',
  'welcome123',
]

// The "target" is deliberately one of the weak sample entries above, to
// illustrate why weak passphrases are crackable. A WPA3-SAE network is
// immune to this style of offline attack regardless of passphrase strength.
export const SAMPLE_TARGET_PASSPHRASE = 'homenet2024'

export const STRONG_PASSPHRASE_EXAMPLE = 'correct-horse-battery-9f2!'
