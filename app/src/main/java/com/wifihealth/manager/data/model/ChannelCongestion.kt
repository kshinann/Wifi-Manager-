package com.wifihealth.manager.data.model

/** How crowded a given channel is, weighted by how strong the interfering signals are. */
data class ChannelCongestion(
    val channel: Int,
    val band: Band,
    val apCount: Int,
    val congestionScore: Int,
)
