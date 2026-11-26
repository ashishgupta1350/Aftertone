package com.prism.music.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.prism.music.data.prefs.AppTemplate
import com.prism.music.data.prefs.ThemeMode
import com.prism.music.ui.theme.LocalAppSettings
import com.prism.music.ui.theme.LocalContainer
import com.prism.music.ui.theme.PrismIcons
import com.prism.music.ui.theme.TemplateIcon

/** Native templates use the same routes, repositories and Media3 session. */
@Composable
fun TemplatePicker() {
    val settings = LocalAppSettings.current
    val repository = LocalContainer.current.settings
    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("App template", style = MaterialTheme.typography.titleLarge)
        Text("Applies to Home, Search, Library, the player and settings.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Column(Modifier.selectableGroup(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            AppTemplate.entries.forEach { template ->
                val selected = settings.appTemplate == template
                val swatches = when (template) {
                    AppTemplate.ORIGINAL -> listOf(0xFF181824, 0xFF3A86FF, 0xFFEEE9FA)
                    AppTemplate.AURORA -> listOf(0xFF473265, 0xFFE6B4DD, 0xFFB69AF1)
                    AppTemplate.ROSEMARY -> listOf(0xFF171225, 0xFFD0AFFA, 0xFF977AB3)
                    AppTemplate.CUPID -> listOf(0xFFF9E9D5, 0xFFE7A2B5, 0xFF673A4B)
                }
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 80.dp)
                        .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(8.dp))
                        .border(if (selected) 2.dp else 1.dp, if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp))
                        .selectable(selected, role = Role.RadioButton) { repository.setAppTemplate(template) }
                        .testTag("template:${template.name}").padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Row(Modifier.size(48.dp), verticalAlignment = Alignment.CenterVertically) {
                        swatches.forEach { color -> Box(Modifier.weight(1f).fillMaxHeight().background(Color(color))) }
                    }
                    Column(Modifier.weight(1f)) {
                        Text(template.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(template.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (selected) TemplateIcon(PrismIcons.Check, "Selected", Modifier.size(24.dp))
                }
            }
        }
        Text("Display mode", style = MaterialTheme.typography.titleMedium)
        Row(Modifier.fillMaxWidth().selectableGroup(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            ThemeMode.entries.forEach { mode ->
                val selected = settings.themeMode == mode
                Box(Modifier.weight(1f).heightIn(min = 48.dp)
                    .background(if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface, RoundedCornerShape(6.dp))
                    .border(1.dp, if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(6.dp))
                    .selectable(selected, role = Role.RadioButton) { repository.setThemeMode(mode) }
                    .testTag("template-mode:${mode.name}").padding(8.dp), contentAlignment = Alignment.Center) {
                    Text(mode.label, style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}
