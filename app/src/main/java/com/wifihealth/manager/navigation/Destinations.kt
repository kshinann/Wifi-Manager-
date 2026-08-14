package com.wifihealth.manager.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.ui.graphics.vector.ImageVector

enum class Destination(val route: String, val label: String, val icon: ImageVector) {
    DASHBOARD("dashboard", "Dashboard", Icons.Default.Dashboard),
    SCAN("scan", "Scan", Icons.Default.Wifi),
    SPEED_TEST("speed_test", "Speed test", Icons.Default.Speed),
    RECOMMENDATIONS("recommendations", "Tips", Icons.Default.Lightbulb),
}
