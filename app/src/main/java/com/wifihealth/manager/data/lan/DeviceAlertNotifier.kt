package com.wifihealth.manager.data.lan

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.wifihealth.manager.R
import com.wifihealth.manager.data.model.DiscoveredDevice

/**
 * Posts a local notification when a LAN scan turns up devices that aren't on the
 * known-devices allow-list. Callers are expected to check [DeviceAlertPreferences] before
 * calling [notifyUnrecognized]; this class itself only guards the Android 13+
 * POST_NOTIFICATIONS runtime permission, silently no-op'ing if it isn't granted rather
 * than crashing.
 */
class DeviceAlertNotifier(private val context: Context) {

    init {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Unrecognized devices",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Alerts when a network scan finds a device that isn't on your known-devices list."
            }
            context.getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    fun notifyUnrecognized(devices: List<DiscoveredDevice>) {
        if (devices.isEmpty()) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        val title = if (devices.size == 1) {
            "Unrecognized device on your network"
        } else {
            "${devices.size} unrecognized devices on your network"
        }
        val names = devices.take(MAX_NAMES_SHOWN).joinToString { it.displayName }
        val text = if (devices.size > MAX_NAMES_SHOWN) {
            "$names, and ${devices.size - MAX_NAMES_SHOWN} more"
        } else {
            names
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(text)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
    }

    companion object {
        private const val CHANNEL_ID = "unrecognized_devices"
        private const val NOTIFICATION_ID = 1001
        private const val MAX_NAMES_SHOWN = 3
    }
}
