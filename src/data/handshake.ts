// A fictional, illustrative walkthrough of the WPA/WPA2 4-way handshake.
// The byte values are placeholders — this is a diagram, not a real capture.
export interface HandshakeStep {
  step: number
  from: 'AP' | 'Client'
  to: 'AP' | 'Client'
  message: string
  payload: string
  explanation: string
}

export const HANDSHAKE_STEPS: HandshakeStep[] = [
  {
    step: 1,
    from: 'AP',
    to: 'Client',
    message: 'Message 1: ANonce',
    payload: 'ANonce = 7f3a…c110 (sample)',
    explanation:
      'The access point generates a random number (ANonce) and sends it to the client. Nothing secret is exposed yet — nonces are meant to be public.',
  },
  {
    step: 2,
    from: 'Client',
    to: 'AP',
    message: 'Message 2: SNonce + MIC',
    payload: 'SNonce = 91de…22b4 (sample), MIC = 4c8f…a01e (sample)',
    explanation:
      'The client generates its own random number (SNonce) and, using the passphrase-derived PMK plus both nonces and MAC addresses, computes the Pairwise Transient Key (PTK). It sends the SNonce and a Message Integrity Code (MIC) computed with that PTK — this MIC is the value an offline attack tries to reproduce by testing candidate passphrases.',
  },
  {
    step: 3,
    from: 'AP',
    to: 'Client',
    message: 'Message 3: GTK + MIC',
    payload: 'GTK (encrypted, sample), MIC = 4c8f…a01e (sample)',
    explanation:
      'Having received the SNonce, the AP can now derive the same PTK. It verifies the client\'s MIC, then sends the Group Temporal Key (GTK, used for broadcast traffic) along with its own MIC.',
  },
  {
    step: 4,
    from: 'Client',
    to: 'AP',
    message: 'Message 4: ACK',
    payload: 'MIC = 9a01…ff23 (sample)',
    explanation:
      'The client confirms installation of the keys. Both sides now share the PTK/GTK and encrypted data traffic can begin.',
  },
]

export const HANDSHAKE_TAKEAWAY =
  'An attacker who captures messages 1 and 2 has everything needed to try candidate passphrases offline: for each guess, derive a PMK, compute a PTK from the two nonces + MAC addresses, and check whether the resulting MIC matches message 2. This is why passphrase strength matters so much for WPA/WPA2-Personal — the protocol itself isn\'t "broken", but a guessable passphrase is.'
