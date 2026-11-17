package com.prism.music.data.foryou

import com.prism.music.data.model.Song

/** Language is missing from most catalogue entries. Use title evidence and the listener's saved artists. */
internal class EnglishSongHints(library: List<Song>) {
    private val englishArtists = library.filter { it.primaryArtist.isNotBlank() }
        .groupBy { it.primaryArtist.lowercase() }
        .filterValues { songs ->
            val english = songs.count(::englishTitle)
            english > 0 && english * 2 > songs.size && songs.none(::regional)
        }.keys

    fun matches(song: Song): Boolean =
        !regional(song) && (englishTitle(song) || song.primaryArtist.lowercase() in englishArtists)

    companion object {
        private val word = Regex("""[\p{L}]+(?:['’][\p{L}]+)?""")
        private val suffix = Regex("""\s*[(\[].*|\s+[–—|-]\s+.*""")
        private val regionalWords = setOf(
            "bollywood", "hindi", "punjabi", "tamil", "telugu", "bengali", "malayalam", "kannada", "bhojpuri",
            "dil", "tum", "tere", "teri", "tera", "mera", "meri", "mere", "mujhe", "nahin", "zindagi", "pyaar",
            "ishq", "sajna", "sajni", "yaar", "jaan", "jaane", "saath", "suno", "khuda", "baatein", "kahani",
            "mohabbat", "hai", "hain", "kya", "kaise", "duniya",
        )
        private val englishWords = setOf(
            "you", "your", "yours", "we", "they", "them", "their", "she", "my", "our", "about", "with", "without",
            "somewhere", "something", "somebody", "someone", "anyone", "nothing", "forever", "never", "always",
            "tonight", "today", "tomorrow", "yesterday", "dream", "dreams", "love", "loved", "loving", "feel",
            "heart", "away", "forgot", "forget", "remember", "night", "alone", "home", "world", "time", "know",
            "alright", "beautiful", "broken", "lost", "found", "before", "after", "only", "where", "when",
            "who", "what", "ever", "that", "this", "alive", "friends", "better", "bad", "good",
            "believe", "dance", "walking", "eyes", "tears", "hold", "stay", "leave", "all", "it's", "don't",
            "can't", "i'm", "you're", "won't",
        )

        private fun words(text: String) = word.findAll(text.lowercase().replace('’', '\'')).map { it.value }.toList()
        private fun baseTitle(song: Song) = song.title.replace(suffix, "")

        private fun regional(song: Song): Boolean =
            words(song.title).any { it in regionalWords } || words(song.album?.title.orEmpty()).any { it in regionalWords } ||
                baseTitle(song).any { it.isLetter() && Character.UnicodeScript.of(it.code) != Character.UnicodeScript.LATIN }

        private fun englishTitle(song: Song): Boolean {
            val titleWords = words(baseTitle(song))
            return !regional(song) && titleWords.count { it in englishWords } >= 2
        }
    }
}

/** Give a smaller pool regular turns while keeping both pools' ranking order. */
internal fun <T> withRegularPicks(ranked: List<T>, priority: List<T>, every: Int, firstAt: Int): List<T> {
    val regular = ranked.iterator()
    val preferred = priority.iterator()
    val picked = LinkedHashSet<T>()
    fun next(items: Iterator<T>): Boolean {
        while (items.hasNext()) if (picked.add(items.next())) return true
        return false
    }
    while (true) {
        val prefer = picked.size % every == firstAt
        if (!(if (prefer) next(preferred) || next(regular) else next(regular) || next(preferred))) break
    }
    return picked.toList()
}
