package com.chargeverse.charge_verse

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Foreground service that listens for the charger. Since Android 8 apps can't
 * receive ACTION_POWER_CONNECTED through the manifest, so a running receiver
 * is the only way to react the moment the user plugs in.
 *
 * Android 10+ also blocks opening an activity from the background, so on
 * plug-in we post a full-screen notification: when the phone is locked the
 * system opens the charging screen straight away; when the user is busy in
 * another app it appears as a heads-up "tap to open" instead.
 */
class ChargeWatcherService : Service() {
    private var registered = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                Intent.ACTION_POWER_CONNECTED -> showChargingScreen()
                Intent.ACTION_POWER_DISCONNECTED ->
                    AutoLaunch.notificationManager(this@ChargeWatcherService)
                        .cancel(AutoLaunch.NOTIF_CHARGING)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        AutoLaunch.ensureChannels(this)
        startInForeground()
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_POWER_CONNECTED)
            addAction(Intent.ACTION_POWER_DISCONNECTED)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(receiver, filter)
        }
        registered = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!AutoLaunch.isEnabled(this)) {
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    override fun onDestroy() {
        if (registered) {
            unregisterReceiver(receiver)
            registered = false
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startInForeground() {
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = AutoLaunch.builder(this, AutoLaunch.CHANNEL_WATCHER)
            .setSmallIcon(android.R.drawable.ic_lock_idle_charging)
            .setContentTitle("ChargeVerse is ready")
            .setContentText("Opens automatically when you plug in")
            .setContentIntent(open)
            .setOngoing(true)
            .setShowWhen(false)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                AutoLaunch.NOTIF_WATCHER,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
        } else {
            startForeground(AutoLaunch.NOTIF_WATCHER, notification)
        }
    }

    private fun showChargingScreen() {
        if (MainActivity.isOnScreen) return
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra(MainActivity.EXTRA_FROM_CHARGER, true)
        }
        val pending = PendingIntent.getActivity(
            this,
            1,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = AutoLaunch.builder(this, AutoLaunch.CHANNEL_CHARGING)
            .setSmallIcon(android.R.drawable.ic_lock_idle_charging)
            .setContentTitle("Charging")
            .setContentText("Tap to open ChargeVerse")
            .setCategory(Notification.CATEGORY_STATUS)
            .setContentIntent(pending)
            .setFullScreenIntent(pending, true)
            .setAutoCancel(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder.setTimeoutAfter(60_000)
        } else {
            @Suppress("DEPRECATION")
            builder.setPriority(Notification.PRIORITY_HIGH)
        }
        AutoLaunch.notificationManager(this).notify(AutoLaunch.NOTIF_CHARGING, builder.build())
    }
}
