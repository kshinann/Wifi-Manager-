// All entries below are entirely fictional sample data for teaching purposes.
// Nothing here comes from a real scan — this app never touches real Wi-Fi hardware.
export type SecurityType = 'Open' | 'WEP' | 'WPA2-PSK' | 'WPA3-SAE'

export interface DemoNetwork {
  id: string
  ssid: string
  bssid: string
  security: SecurityType
  signal: number // simulated dBm
  channel: number
  summary: string
  risk: 'critical' | 'high' | 'medium' | 'low'
  details: string
}

export const SECURITY_INFO: Record<SecurityType, { title: string; description: string; risk: DemoNetwork['risk'] }> = {
  Open: {
    title: 'Open / No Encryption',
    risk: 'critical',
    description:
      'Traffic is sent in the clear. Anyone nearby with a Wi-Fi adapter can read unencrypted data passing over the air — no "cracking" is even required.',
  },
  WEP: {
    title: 'WEP (Wired Equivalent Privacy)',
    risk: 'critical',
    description:
      'Deprecated since 2004. WEP reuses short initialization vectors with RC4, so collecting a few tens of thousands of packets lets statistical attacks (e.g. the FMS/PTW family of attacks used by tools like aircrack-ng) recover the key. It should never be used today.',
  },
  'WPA2-PSK': {
    title: 'WPA2-Personal (PSK)',
    risk: 'medium',
    description:
      'Uses AES-CCMP and a 4-way handshake to derive session keys from a shared passphrase. The protocol itself is sound, but a weak, short, or common-word passphrase can be recovered offline via dictionary or brute-force attacks against a captured handshake.',
  },
  'WPA3-SAE': {
    title: 'WPA3-Personal (SAE)',
    risk: 'low',
    description:
      'Replaces the PSK exchange with Simultaneous Authentication of Equals (SAE), a password-authenticated key exchange that resists offline dictionary attacks even against weak passphrases, and provides forward secrecy.',
  },
}

export const DEMO_NETWORKS: DemoNetwork[] = [
  {
    id: 'net-1',
    ssid: 'CoffeeShop_Guest',
    bssid: '02:00:00:AA:11:01',
    security: 'Open',
    signal: -42,
    channel: 6,
    summary: 'No password, no encryption',
    risk: 'critical',
    details: SECURITY_INFO.Open.description,
  },
  {
    id: 'net-2',
    ssid: 'OldRouter_Legacy',
    bssid: '02:00:00:AA:11:02',
    security: 'WEP',
    signal: -58,
    channel: 1,
    summary: 'Legacy WEP encryption',
    risk: 'critical',
    details: SECURITY_INFO.WEP.description,
  },
  {
    id: 'net-3',
    ssid: 'HomeNetwork_2G',
    bssid: '02:00:00:AA:11:03',
    security: 'WPA2-PSK',
    signal: -51,
    channel: 11,
    summary: 'WPA2 with a weak sample passphrase',
    risk: 'medium',
    details: SECURITY_INFO['WPA2-PSK'].description,
  },
  {
    id: 'net-4',
    ssid: 'SecureOffice_5G',
    bssid: '02:00:00:AA:11:04',
    security: 'WPA3-SAE',
    signal: -66,
    channel: 149,
    summary: 'Modern WPA3-SAE',
    risk: 'low',
    details: SECURITY_INFO['WPA3-SAE'].description,
  },
]
