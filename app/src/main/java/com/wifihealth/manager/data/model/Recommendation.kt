package com.wifihealth.manager.data.model

enum class Severity(val label: String) {
    CRITICAL("Critical"),
    WARNING("Warning"),
    INFO("Info"),
    GOOD("Good"),
}

enum class RecommendationCategory(val label: String) {
    SIGNAL("Signal strength"),
    SECURITY("Security"),
    CONGESTION("Channel congestion"),
    BAND("Frequency band"),
    PERFORMANCE("Performance"),
    CONFIGURATION("Configuration"),
}

data class Recommendation(
    val category: RecommendationCategory,
    val severity: Severity,
    val title: String,
    val detail: String,
)

/** Aggregate 0-100 health score for the active connection, plus the reasoning behind it. */
data class HealthScore(
    val overall: Int,
    val signalScore: Int,
    val securityScore: Int,
    val congestionScore: Int,
    val performanceScore: Int?,
) {
    val label: String
        get() = when {
            overall >= 85 -> "Excellent"
            overall >= 70 -> "Good"
            overall >= 50 -> "Fair"
            else -> "Needs attention"
        }
}

data class NetworkHealthReport(
    val healthScore: HealthScore,
    val recommendations: List<Recommendation>,
)
