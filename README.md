## obsidian separated recurrence

this is my custom implementation of spaced repetition for [obsidian](https://ww.obsidian.md) (see [the original plugin](https://github.com/st3v3nmw/obsidian-spaced-repetition) that inspired this)

### syntax

note: all of the following can be escaped using ```\```

```:``` - one-sided card<br>
```::``` - two-sided card<br>
```/``` - used in term or definition to separate alternate terms/definitions, generates the following cards:<br>
- per term - *term*:*all definitions*
- per definition - *definition*:*all terms* (if double sided)

```{|}``` - used in the term to mark [furigana](https://github.com/steven-kraft/obsidian-markdown-furigana), generates the following cards:
- *kanji* (definition):*definition*
- *kanji* (reading):*reading*
- *furigana*:*definition*
- and if double sided:
	- *reading*:*furigana*
	- *definition*:*furigana*

```%%``` *text* ```%%``` - comment<br>
```<!--``` *text* ```-->``` - comment<br>
```---``` - comments out the entire rest of the file

### hotkeys

```{space}``` - show answer<br>
```w,a,s,d``` or ````i,j,k,l```` - wrong, easy, medium, and hard respectively

### to do

- clozures? (using ```==highlighting==``` or ```**bolding**```)
- better flashcard-picking algorithm (currently just picks a random due card)
- custom flashcards directory (currently ```flashcards``` subdirectory)
