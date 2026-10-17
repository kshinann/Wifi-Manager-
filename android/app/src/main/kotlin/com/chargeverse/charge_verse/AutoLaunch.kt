package com.chargeverse.charge_verse

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.PowerManager
import android.util.Log

/**
 * The "open automatically when charging" setting and the bits of system state
 * it depends on. The flag lives in native SharedPreferences so BootReceiver
 * can read it without starting Flutter.
 */
object AutoLaunch {
    private const val TAG = "ChargeVerse"
    private const val PREFS = "chargeverse_auto_launch"
    private const val KEY_ENABLED = "enabled"

    const val CHANNEL_WATCHER = "watcher"
    const val CHANNEL_CHARGING = "charging"
    const val NOTIF_WATCHER = 1
    const val NOTIF_CHARGING = 2

    fun isEnabled(ctx: Context): Boolean =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false)

    fun setEnabled(ctx: Context, enabled: Boolean) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_ENABLED, enabled).apply()
        if (enabled) start(ctx) else stop(ctx)
    }

    /** Starts the watcher if the user turned the feature on. Safe to call repeatedly. */
    fun start(ctx: Context) {
        if (!isEnabled(ctx)) return
        val intent = Intent(ctx, ChargeWatcherService::class.java)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
        } catch (e: Exception) {
            // Android 12+ refuses foreground-service starts from some background
            // states; the next app launch or reboot starts it instead.
            Log.w(TAG, "Could not start charge watcher", e)
        }
    }

    fun stop(ctx: Context) {
        ctx.stopService(Intent(ctx, ChargeWatcherService::class.java))
        notificationManager(ctx).cancel(NOTIF_CHARGING)
    }

    fun notificationsAllowed(ctx: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
        } else {
            notificationManager(ctx).areNotificationsEnabled()
        }

    /** Android 14+ lets users (and Play) revoke full-screen notifications. */
    fun fullScreenAllowed(ctx: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            notificationManager(ctx).canUseFullScreenIntent()
        } else {
            true
        }

    fun batteryUnrestricted(ctx: Context): Boolean {
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        return pm.isIgnoringBatteryOptimizations(ctx.packageName)
    }

    fun status(ctx: Context): Map<String, Any> = mapOf(
        "supported" to true,
        "enabled" to isEnabled(ctx),
        "notificationsAllowed" to notificationsAllowed(ctx),
        "fullScreenAllowed" to fullScreenAllowed(ctx),
        "batteryUnrestricted" to batteryUnrestricted(ctx),
        "manufacturer" to Build.MANUFACTURER.lowercase(),
    )

    fun notificationManager(ctx: Context): NotificationManager =
        ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    fun ensureChannels(ctx: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = notificationManager(ctx)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_WATCHER, "Charger watcher", NotificationManager.IMPORTANCE_MIN).apply {
                description = "Keeps ChargeVerse ready to open when you plug in."
                setShowBadge(false)
            },
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_CHARGING, "Charging screen", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Opens the charging screen when you plug in."
                setSound(null, null)
                enableVibration(false)
                setShowBadge(false)
            },
        )
    }

    @Suppress("DEPRECATION")
    fun builder(ctx: Context, channel: String): Notification.Builder =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(ctx, channel)
        } else {
            Notification.Builder(ctx)
        }
}
