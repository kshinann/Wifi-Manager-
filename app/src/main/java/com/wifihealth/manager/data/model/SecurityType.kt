package com.wifihealth.manager.data.model

/** Normalized Wi-Fi security protocol, ordered from weakest to strongest. */
enum class SecurityType(val label: String, val strengthScore: Int) {
    OPEN("Open (no password)", 0),
    WEP("WEP", 1),
    WPA("WPA", 2),
    WPA2("WPA2", 3),
    WPA3("WPA3", 4),
    ENTERPRISE("WPA2/WPA3-Enterprise", 4),
    UNKNOWN("Unknown", 1);

    val isWeak: Boolean get() = this == OPEN || this == WEP || this == WPA

    companion object {
        /**
         * Parses the `capabilities` string reported by [android.net.wifi.ScanResult],
         * e.g. "[RSN-SAE-CCMP][ESS]" (WPA3), "[WPA2-PSK-CCMP][ESS]" (WPA2),
         * "[WEP][ESS]" or "[ESS]" (open). Order matters: WPA3/SAE and EAP must be
         * checked before the generic "WPA" substring since "WPA2"/"WPA3" both
         * contain "WPA".
         */
        fun fromCapabilities(capabilities: String): SecurityType {
            val caps = capabilities.uppercase()
            return when {
                caps.contains("SAE") || caps.contains("WPA3") -> WPA3
                caps.contains("EAP") || caps.contains("802.1X") -> ENTERPRISE
                caps.contains("WPA2") || caps.contains("RSN") -> WPA2
                caps.contains("WPA") -> WPA
                caps.contains("WEP") -> WEP
                caps.contains("ESS") || caps.isBlank() -> OPEN
                else -> UNKNOWN
            }
        }
    }
}
