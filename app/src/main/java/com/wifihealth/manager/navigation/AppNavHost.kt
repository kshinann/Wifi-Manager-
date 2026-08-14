package com.wifihealth.manager.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.compose.composable
import com.wifihealth.manager.ui.dashboard.DashboardScreen
import com.wifihealth.manager.ui.recommendations.RecommendationsScreen
import com.wifihealth.manager.ui.scan.ScanScreen
import com.wifihealth.manager.ui.speedtest.SpeedTestScreen

@Composable
fun AppNavHost() {
    val navController = rememberNavController()

    Scaffold(
        bottomBar = {
            NavigationBar {
                val backStackEntry by navController.currentBackStackEntryAsState()
                val currentRoute = backStackEntry?.destination?.route
                Destination.entries.forEach { destination ->
                    NavigationBarItem(
                        selected = currentRoute == destination.route,
                        onClick = {
                            navController.navigate(destination.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(destination.icon, contentDescription = destination.label) },
                        label = { Text(destination.label) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Destination.DASHBOARD.route,
            modifier = Modifier.padding(padding),
        ) {
            composable(Destination.DASHBOARD.route) {
                DashboardScreen(
                    onSeeAllRecommendations = {
                        navController.navigate(Destination.RECOMMENDATIONS.route) {
                            launchSingleTop = true
                        }
                    },
                )
            }
            composable(Destination.SCAN.route) { ScanScreen() }
            composable(Destination.SPEED_TEST.route) { SpeedTestScreen() }
            composable(Destination.RECOMMENDATIONS.route) { RecommendationsScreen() }
        }
    }
}
