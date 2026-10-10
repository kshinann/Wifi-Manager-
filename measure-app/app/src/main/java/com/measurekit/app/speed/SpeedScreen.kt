package com.measurekit.app.speed

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.measurekit.app.units.UnitSystem

/** Speed of an external object: live with two camera gates, or afterwards from a video. */
@Composable
fun SpeedScreen(units: UnitSystem, modifier: Modifier = Modifier) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    Column(modifier) {
        TabRow(selectedTabIndex = tab) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("Live (camera gates)") })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("From video") })
        }
        val content = Modifier.fillMaxSize()
        when (tab) {
            0 -> GateSpeedScreen(units, content)
            else -> VideoSpeedScreen(units, content)
        }
    }
}
