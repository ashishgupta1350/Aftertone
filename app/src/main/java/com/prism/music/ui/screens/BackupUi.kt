package com.prism.music.ui.screens

import com.prism.music.R
import com.prism.music.tr
import com.prism.music.ui.components.PrismTextButton
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.prism.music.ui.theme.LocalContainer
import kotlinx.coroutines.launch

private fun backupName() = tr(R.string.prism_backup) + java.text.SimpleDateFormat(tr(R.string.yyyy_mm_dd), java.util.Locale.US).format(java.util.Date()) + ".zip"

private fun sizeText(bytes: Long) = when {
    bytes >= 1_073_741_824L -> tr(R.string.t_1f_gb).format(bytes / 1_073_741_824.0)
    else -> tr(R.string.t_0f_mb).format(maxOf(bytes, 1_048_576L) / 1_048_576.0)
}

/**
 * Backing up: asks whether the downloaded audio goes in too, then where to save the file.
 * [onDone] gets whether the backup was written.
 */
@Composable
fun rememberBackupFlow(onDone: (Boolean) -> Unit = {}): () -> Unit {
    val c = LocalContainer.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var asking by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    // What goes in (#149): everything but the downloaded audio, as before; any part can stay out (to share your settings
    // without your listening or your sign-in).
    var parts by remember { mutableStateOf(com.prism.music.data.BackupPart.entries.toSet() - com.prism.music.data.BackupPart.DOWNLOADS) }
    val save = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { uri ->
        if (uri == null) { onDone(false); return@rememberLauncherForActivityResult }
        busy = true
        scope.launch {
            val r = runCatching { c.backup.export(uri, parts) }
            busy = false
            Toast.makeText(context, r.exceptionOrNull()?.let { tr(R.string.backup_failed, it.message) } ?: tr(R.string.backed_up), Toast.LENGTH_SHORT).show()
            onDone(r.isSuccess)
        }
    }
    if (asking) {
        var size by remember { mutableLongStateOf(0L) }
        LaunchedEffect(parts) { size = c.backup.estimate(parts) }
        AlertDialog(
            onDismissRequest = { asking = false },
            title = { Text(tr(R.string.back_up_prism)) },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    Text(tr(R.string.pick_what_goes_into_the_file), style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(6.dp))
                    com.prism.music.data.BackupPart.entries.forEach { part ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            PrismCheck(part in parts, label = part.label) { on -> parts = if (on) parts + part else parts - part }
                            Column(Modifier.weight(1f).padding(vertical = 6.dp)) {
                                Text(part.label, style = MaterialTheme.typography.bodyLarge)
                                Text(part.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        tr(R.string.about_2, sizeText(size)) + if (com.prism.music.data.BackupPart.ACCOUNTS in parts) tr(R.string.keep_it_private_it_can_sign) else "",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
            confirmButton = { PrismTextButton(onClick = { asking = false; save.launch(backupName()) }, enabled = parts.isNotEmpty()) { Text(tr(R.string.choose_where)) } },
            dismissButton = { PrismTextButton(onClick = { asking = false }) { Text(tr(R.string.cancel)) } },
        )
    }
    if (busy) WorkingDialog(tr(R.string.backing_up))
    return { asking = true }
}

/** Restoring: pick a backup, confirm, and Prism restarts with it. */
@Composable
fun rememberRestoreFlow(): () -> Unit {
    val c = LocalContainer.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var picked by remember { mutableStateOf<android.net.Uri?>(null) }
    var busy by remember { mutableStateOf(false) }
    val open = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { picked = it }
    picked?.let { uri ->
        // What the file holds: only those parts are replaced (#149); the rest stays as it is here.
        val parts by androidx.compose.runtime.produceState<Set<com.prism.music.data.BackupPart>?>(null, uri) { value = c.backup.partsOf(uri) }
        AlertDialog(
            onDismissRequest = { picked = null },
            title = { Text(tr(R.string.restore_this_backup)) },
            text = {
                Text(
                    parts?.let { p ->
                        tr(R.string.it_holds_parts, com.prism.music.data.looks.LookLabels.listed(com.prism.music.data.BackupPart.entries.filter { it in p }.map { it.label }))

                    } ?: tr(R.string.prism_s_library_history_and_settings),
                )
            },
            confirmButton = {
                PrismTextButton(onClick = {
                    picked = null
                    busy = true
                    scope.launch {
                        // Only comes back if it failed; on success Prism restarts.
                        runCatching { c.backup.restore(uri) }.onFailure {
                            busy = false
                            Toast.makeText(context, tr(R.string.couldn_t_restore, it.message), Toast.LENGTH_LONG).show()
                        }
                    }
                }) { Text(tr(R.string.restore)) }
            },
            dismissButton = { PrismTextButton(onClick = { picked = null }) { Text(tr(R.string.cancel)) } },
        )
    }
    if (busy) WorkingDialog(tr(R.string.restoring))
    return { open.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) }
}

@Composable
private fun WorkingDialog(text: String) {
    AlertDialog(
        onDismissRequest = {},
        confirmButton = {},
        text = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                com.prism.music.ui.components.PrismSpinner(Modifier.size(24.dp), stroke = 2.5.dp)
                Spacer(Modifier.width(16.dp))
                Text(text)
            }
        },
    )
}

/** On the welcome screen, for a fresh install coming from a backup. */
@Composable
fun WelcomeRestoreButton() {
    val restore = rememberRestoreFlow()
    PrismTextButton(onClick = restore, Modifier.fillMaxWidth()) { Text(tr(R.string.restore_from_a_backup), color = Color.White.copy(alpha = 0.8f)) }
}
