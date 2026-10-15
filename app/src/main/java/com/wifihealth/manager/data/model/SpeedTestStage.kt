package com.wifihealth.manager.data.model

enum class SpeedTestStage(val label: String) {
    IDLE("Idle"),
    LATENCY("Measuring latency"),
    DOWNLOAD("Measuring download speed"),
    UPLOAD("Measuring upload speed"),
    DONE("Done"),
}
