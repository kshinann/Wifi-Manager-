package com.measurekit.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Straighten
import androidx.compose.material.icons.filled.ViewInAr
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.measurekit.app.ar.ArMeasureScreen
import com.measurekit.app.ar.ArMode
import com.measurekit.app.liquid.LiquidScreen
import com.measurekit.app.speed.SpeedScreen
import com.measurekit.app.ui.MeasureKitTheme
import com.measurekit.app.units.UnitSystem

private enum class Tool(val title: String, val icon: ImageVector) {
    LENGTH("Length", Icons.Filled.Straighten),
    SIZE("Size", Icons.Filled.ViewInAr),
    LIQUID("Liquid", Icons.Filled.WaterDrop),
    SPEED("Speed", Icons.Filled.Speed),
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { MeasureKitTheme { MeasureKitApp() } }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MeasureKitApp() {
    var tool by rememberSaveable { mutableStateOf(Tool.LENGTH) }
    var units by rememberSaveable { mutableStateOf(UnitSystem.METRIC) }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(tool.title) },
                actions = {
                    TextButton(onClick = {
                        units = if (units == UnitSystem.METRIC) UnitSystem.IMPERIAL else UnitSystem.METRIC
                    }) { Text(if (units == UnitSystem.METRIC) "Metric" else "Imperial") }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                Tool.entries.forEach { t ->
                    NavigationBarItem(
                        selected = t == tool,
                        onClick = { tool = t },
                        icon = { Icon(t.icon, contentDescription = null) },
                        label = { Text(t.title) },
                    )
                }
            }
        },
    ) { padding ->
        val content = Modifier
            .fillMaxSize()
            .padding(padding)
        when (tool) {
            Tool.LENGTH -> ArMeasureScreen(ArMode.LENGTH, units, content)
            Tool.SIZE -> ArMeasureScreen(ArMode.BOX, units, content)
            Tool.LIQUID -> LiquidScreen(units, content)
            Tool.SPEED -> SpeedScreen(units, content)
        }
    }
}
