package com.prism.music.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.prism.music.AppContainer
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
internal fun AftertoneAccountGate(c: AppContainer, content: @Composable () -> Unit) {
    val account = c.aftertoneAccount
    val access by account.access.collectAsState()
    if (access.allowed) {
        content()
        return
    }
    var signup by rememberSaveable { mutableStateOf(false) }
    var id by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var working by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    MaterialTheme {
        Surface(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(
                    Modifier.widthIn(max = 430.dp).verticalScroll(rememberScrollState()).padding(28.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Text(if (signup) "Create your Aftertone account" else "Sign in to Aftertone", style = MaterialTheme.typography.headlineMedium)
                    Text("Use the same account on Android and the web to sync your music.")
                    OutlinedTextField(
                        id, { id = it.take(200) }, Modifier.fillMaxWidth(), label = { Text("Email, phone number, or username") },
                        singleLine = true, enabled = !working,
                    )
                    OutlinedTextField(
                        password, { password = it.take(128) }, Modifier.fillMaxWidth(), label = { Text("Password") },
                        singleLine = true, enabled = !working, visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    )
                    (error ?: access.message)?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    Button(
                        onClick = {
                            working = true
                            error = null
                            scope.launch {
                                try { account.signIn(id, password, signup); password = "" }
                                catch (e: CancellationException) { throw e }
                                catch (e: Exception) { error = e.message ?: "Couldn’t sign in to Aftertone." }
                                finally { working = false }
                            }
                        },
                        enabled = !working && id.isNotBlank() && password.length >= if (signup) 8 else 1,
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text(if (working) "Connecting…" else if (signup) "Create account" else "Sign in") }
                    TextButton(
                        onClick = { signup = !signup; password = ""; error = null }, enabled = !working,
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text(if (signup) "Back to sign in" else "Create an account") }
                }
            }
        }
    }
}
