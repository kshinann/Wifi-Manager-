package com.wifihealth.manager.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.wifihealth.manager.data.model.Severity
import com.wifihealth.manager.ui.theme.SeverityCritical
import com.wifihealth.manager.ui.theme.SeverityGood
import com.wifihealth.manager.ui.theme.SeverityInfo
import com.wifihealth.manager.ui.theme.SeverityWarning

@Composable
fun SeverityBadge(severity: Severity, modifier: Modifier = Modifier) {
    val color = when (severity) {
        Severity.CRITICAL -> SeverityCritical
        Severity.WARNING -> SeverityWarning
        Severity.INFO -> SeverityInfo
        Severity.GOOD -> SeverityGood
    }
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(text = severity.label, color = color, style = MaterialTheme.typography.labelSmall)
    }
}
