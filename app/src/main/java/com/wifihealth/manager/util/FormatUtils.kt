package com.wifihealth.manager.util

import kotlin.math.roundToInt

object FormatUtils {

    fun mbps(value: Double?): String = value?.let { "%.1f Mbps".format(it) } ?: "--"

    fun ms(value: Double?): String = value?.let { "${it.roundToInt()} ms" } ?: "--"

    fun percent(value: Double?): String = value?.let { "%.0f%%".format(it) } ?: "--"

    fun dbm(value: Int?): String = value?.let { "$it dBm" } ?: "--"

    fun mhz(value: Int?): String = value?.let { "$it MHz" } ?: "--"
}
