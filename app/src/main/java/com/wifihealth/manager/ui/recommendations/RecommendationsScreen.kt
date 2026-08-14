package com.wifihealth.manager.ui.recommendations

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.wifihealth.manager.data.model.Recommendation
import com.wifihealth.manager.di.appContainer
import com.wifihealth.manager.ui.components.SectionCard
import com.wifihealth.manager.ui.components.SeverityBadge

@Composable
fun RecommendationsScreen() {
    val context = LocalContext.current
    val container = remember { context.appContainer() }
    val viewModel: RecommendationsViewModel = viewModel(factory = RecommendationsViewModel.factory(container))
    val report by viewModel.report.collectAsState()

    Scaffold(topBar = { TopAppBar(title = { Text("Recommendations") }) }) { padding ->
        val recommendations = report?.recommendations.orEmpty()
        if (recommendations.isEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("Analyzing your network...", style = MaterialTheme.typography.bodyLarge)
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(recommendations, key = { it.title }) { RecommendationCard(it) }
        }
    }
}

@Composable
private fun RecommendationCard(recommendation: Recommendation) {
    SectionCard(title = recommendation.category.label) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            SeverityBadge(recommendation.severity)
        }
        Spacer(Modifier.height(8.dp))
        Text(recommendation.title, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(4.dp))
        Text(recommendation.detail, style = MaterialTheme.typography.bodyMedium)
    }
}
