package com.prism.music.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.prism.music.data.prefs.AppTemplate
import com.prism.music.data.prefs.ThemeMode

/** Titles keep their full width. Secondary actions scroll instead of squeezing a narrow phone. */
@Composable
fun TemplateHeader(title: String, modifier: Modifier = Modifier, subtitle: String? = null, actions: @Composable RowScope.() -> Unit = {}) {
    val s = LocalAppSettings.current
    val c = LocalContainer.current
    val dark = LocalIsDark.current
    val scheme = MaterialTheme.colorScheme
    Column(modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 56.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                if (!subtitle.isNullOrBlank()) Text(subtitle, style = MaterialTheme.typography.labelMedium, color = scheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(title, style = MaterialTheme.typography.headlineMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            IconButton({ c.settings.setThemeMode(if (dark) ThemeMode.LIGHT else ThemeMode.DARK) }, Modifier.size(48.dp)) {
                TemplateIcon(CupidNativeIcons.named(if (dark) "Sun" else "Moon"), if (dark) "Switch to light mode" else "Switch to dark mode", Modifier.size(24.dp))
            }
        }
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, content = actions)
        if (s.appTemplate == AppTemplate.CUPID) HorizontalDivider(Modifier.padding(top = 6.dp), color = scheme.outlineVariant)
    }
}
