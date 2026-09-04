package com.varia.multirepellent

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.varia.multirepellent.ui.RepellentApp
import com.varia.multirepellent.ui.theme.MultiRepellentTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MultiRepellentTheme {
                RepellentApp()
            }
        }
    }
}
