package com.wifihealth.manager

import android.app.Application
import com.google.android.gms.ads.MobileAds
import com.wifihealth.manager.di.AppContainer

class WifiHealthApplication : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        MobileAds.initialize(this)
    }
}
