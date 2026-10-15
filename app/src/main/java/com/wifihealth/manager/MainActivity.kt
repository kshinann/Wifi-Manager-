package com.wifihealth.manager

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.wifihealth.manager.navigation.AppNavHost
import com.wifihealth.manager.ui.permission.PermissionGateScreen
import com.wifihealth.manager.ui.theme.WifiHealthTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            WifiHealthTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    PermissionGateScreen {
                        AppNavHost()
                    }
                }
            }
        }
    }
}
