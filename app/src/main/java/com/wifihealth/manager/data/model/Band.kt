package com.wifihealth.manager.data.model

/** Wi-Fi frequency band, derived from a scan/connection frequency in MHz. */
enum class Band(val label: String) {
    GHZ_2_4("2.4 GHz"),
    GHZ_5("5 GHz"),
    GHZ_6("6 GHz"),
    UNKNOWN("Unknown");

    companion object {
        fun fromFrequencyMhz(freqMhz: Int): Band = when (freqMhz) {
            in 2400..2500 -> GHZ_2_4
            in 4900..5900 -> GHZ_5
            in 5925..7125 -> GHZ_6
            else -> UNKNOWN
        }
    }
}
