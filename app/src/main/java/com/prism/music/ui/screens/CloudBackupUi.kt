package com.prism.music.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.prism.music.R
import com.prism.music.data.CloudBackup
import com.prism.music.tr
import com.prism.music.ui.components.PrismButton
import com.prism.music.ui.components.PrismOutlinedButton
import com.prism.music.ui.components.PrismTextButton
import com.prism.music.ui.theme.LocalContainer
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

@Composable
internal fun rememberCloudBackupFlow(): () -> Unit {
    val container = LocalContainer.current
    val cloud = remember(container) { CloudBackup(container) }
    val scope = rememberCoroutineScope()
    var opened by remember { mutableStateOf(false) }
    var phone by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var account by remember { mutableStateOf<CloudBackup.Account?>(null) }
    var savedAt by remember { mutableStateOf<Long?>(null) }
    var busy by remember { mutableStateOf(false) }
    var confirmingRestore by remember { mutableStateOf(false) }
    var problem by remember { mutableStateOf<Int?>(null) }

    fun close() {
        opened = false
        password = ""
        account = null
        savedAt = null
        problem = null
    }

    fun run(action: suspend () -> Unit) {
        if (busy) return
        busy = true
        problem = null
        scope.launch {
            try {
                action()
            } catch (e: CancellationException) {
                throw e
            } catch (e: CloudBackup.Failure) {
                problem = e.reason
            } catch (_: Exception) {
                problem = R.string.cloud_unavailable
            } finally {
                busy = false
            }
        }
    }

    val signedIn = account
    if (opened) AlertDialog(
        onDismissRequest = { if (!busy) close() },
        title = { Text(tr(R.string.cloud_backup)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (signedIn == null) {
                    Text(tr(R.string.cloud_backup_sign_in))
                    OutlinedTextField(
                        phone, { phone = it }, Modifier.fillMaxWidth(),
                        label = { Text(tr(R.string.cloud_phone_number)) },
                        singleLine = true, enabled = !busy,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    )
                    OutlinedTextField(
                        password, { password = it }, Modifier.fillMaxWidth(),
                        label = { Text(tr(R.string.cloud_password)) },
                        singleLine = true, enabled = !busy,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        visualTransformation = PasswordVisualTransformation(),
                    )
                } else {
                    Text(savedAt?.let { time ->
                        tr(R.string.cloud_backup_last, DateFormat.getDateTimeInstance().format(Date(time)))
                    } ?: tr(R.string.cloud_backup_none))
                    Text(tr(R.string.cloud_backup_contents), style = MaterialTheme.typography.bodySmall)
                    PrismButton(onClick = { run { savedAt = cloud.save(signedIn) } }, enabled = !busy) {
                        Text(tr(R.string.cloud_backup_now))
                    }
                    PrismOutlinedButton(
                        onClick = { confirmingRestore = true }, enabled = !busy && savedAt != null,
                    ) { Text(tr(R.string.cloud_backup_restore)) }
                }
                if (busy) Text(tr(R.string.cloud_working))
                problem?.let { Text(tr(it), color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            if (signedIn == null) PrismTextButton(
                onClick = {
                    val number = phone
                    val secret = password
                    password = ""
                    run {
                        val authenticated = cloud.signIn(number, secret)
                        savedAt = cloud.savedAt(authenticated)
                        account = authenticated
                    }
                },
                enabled = !busy && phone.isNotBlank() && password.isNotBlank(),
            ) { Text(tr(R.string.sign_in)) }
            else PrismTextButton(onClick = { close() }, enabled = !busy) { Text(tr(R.string.done)) }
        },
        dismissButton = {
            if (signedIn == null) PrismTextButton(onClick = { close() }, enabled = !busy) { Text(tr(R.string.cancel)) }
        },
    )
    if (confirmingRestore && signedIn != null) AlertDialog(
        onDismissRequest = { confirmingRestore = false },
        title = { Text(tr(R.string.cloud_backup_restore)) },
        text = { Text(tr(R.string.cloud_backup_restore_confirm)) },
        confirmButton = {
            PrismTextButton(onClick = {
                confirmingRestore = false
                run { cloud.restore(signedIn) }
            }) { Text(tr(R.string.cloud_backup_restore)) }
        },
        dismissButton = { PrismTextButton(onClick = { confirmingRestore = false }) { Text(tr(R.string.cancel)) } },
    )
    return { opened = true }
}
