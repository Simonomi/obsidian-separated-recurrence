const fuzziness = .50 // as a percentage

const newlineRegex = /^((?:[^\\]|\\\\|\\[^n])*)\\n/gm
const carriageReturnRegex = /^((?:[^\\]|\\\\|\\[^r])*)\\r/gm
const furiganaRegex = /{(?<kanji>(?:[\u4E00-\u9FFFㄅ-ㄩぁ-んァ-ンー〇])+)(?<kana>(?:\|[^ -\/{-~:-@\[-`]*)+)}/gm
const parseCommentRegex = /(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})(?<level>\d+)/

function base10to65536(inputNumber) {
	let output = ""
	do {
		output = String.fromCharCode(inputNumber % 2 ** 16) + output;
		inputNumber = Math.floor(inputNumber / 2 ** 16);
	} while(inputNumber > 0);
	return output.replace(/([%\\`\[\]])/g, "\\$1").replaceAll("\n", "\\n").replaceAll("\r", "\\r")
}

function base65536to10(inputString) {
	while (inputString.match(newlineRegex)) {
		inputString = inputString.replace(newlineRegex, "$1\n")
	}
	while (inputString.match(carriageReturnRegex)) {
		inputString = inputString.replace(carriageReturnRegex, "$1\r")
	}
	inputString = inputString.replace(/\\([%\\`\[\]])/g, "$1")
	let output = 0
	for (let i = 0; i < inputString.length; i++) {
		output += inputString.charCodeAt(inputString.length - i - 1) * ((2 ** 16) ** i)
	}
	return output
}

export class Card {
	app: App
	file: TFile
	isDoubleSided: boolean
	flashcards: Flashcard[] = []
	
	originalText: string
	originalTerm: string
	originalDefinition: string
	
	constructor(app: App, term: string, definition: string, doubleSided: boolean, srComments: string, file: TFile, originalText: string) {
		this.app = app
		this.file = file;
		this.isDoubleSided = doubleSided;
		
		this.originalText = originalText
		this.originalTerm = term.trim();
		this.originalDefinition = definition.trim();
		
		let inputTerms = term.replaceAll("\\/", "|||||") // TODO: find a better way to do this
		inputTerms = inputTerms.split("/").map(x => x.replaceAll("|||||", "/").trim());
		let definitions = definition.replaceAll("\\/", "|||||")
		definitions = definitions.split("/").map(x => x.replaceAll("|||||", "/").trim());
		
		let uniqueKanji = []
		let uniqueReadings = []
		let terms = []
		for (let term of inputTerms) {
			let termKanji = term.replace(furiganaRegex, "$<kanji>")
			let termReading = term.replace(furiganaRegex, "$<kana>").replaceAll("|", "")
			
			if (termKanji == termReading) { // no furigana
				terms.push(term)
			} else {
				if (termKanji in uniqueKanji) {
					if (!uniqueKanji[termKanji].includes(termReading)) {
						uniqueKanji[termKanji].push(termReading)
					}
				} else {
					uniqueKanji[termKanji] = [termReading]
				}
			
				if (!uniqueReadings.includes(termReading)) {
					uniqueReadings.push(termReading)
				}
			}
		}
		
		for (let [kanji, readings] of Object.entries(uniqueKanji)) {
			const pluralReadings = readings.length > 1 ? "s" : ""
			this.flashcards.push(new Flashcard(`${kanji} (reading${pluralReadings})`, readings.join("/")))
			
			const pluralDefinitions = definitions.length > 1 ? "s" : ""
			this.flashcards.push(new Flashcard(`${kanji} (definition${pluralDefinitions})`, definitions.join("/")))
		}
		
		for (let reading of uniqueReadings) {
			this.flashcards.push(new Flashcard(reading, `${inputTerms.join("/")} (${definitions.join("/")})`))
		}
		
		for (let term of terms) {
			this.flashcards.push(new Flashcard(term, definitions.join("/")))
		}
		
		if (this.isDoubleSided) {
			for (let definition of definitions) {
				this.flashcards.push(new Flashcard(definition, inputTerms.join("/")))
			}
		}
		
		let comments = []
		if (srComments != undefined) {
			srComments = srComments.split(" ")
			for (let comment of srComments) {
				const base10 = base65536to10(comment).toString()
				comments.push(base10.match(parseCommentRegex))
			}
		}
		
		for (let index in this.flashcards) {
			if (comments[index] != undefined) {
				let comment = comments[index].groups
				this.flashcards[index].dueDate = new Date(
					parseInt(comment.year),
					parseInt(comment.month) - 1, // zero-indexed
					parseInt(comment.day)
				)
				this.flashcards[index].level = comment.level
			}
		}
	}
	
	isDue(currentDate: Date = new Date()): boolean {
		let dueCount = this.flashcards.filter(x => x.isDue(currentDate)).length
		return dueCount * 2 >= this.flashcards.length // due if >= half of its flashcards are due
	}
	
	getFlashcard(): Flashcard { // TODO: change this
		const dueFlashcards = this.flashcards.filter(x => x.isDue())
		return dueFlashcards[Math.floor(Math.random() * dueFlashcards.length)]
	}
	
	toString(): string {
		const difficulties = this.flashcards.map(x => x.toString())
		
		let comment = ""
		if (difficulties.length > 0) {
			comment = " %%sr" + difficulties.join(" ") + "%%"
		}
		
		const separator = this.isDoubleSided ? "::" : ":"
		return `${this.originalTerm}${separator}${this.originalDefinition}${comment}`
	}
	
	async writeChanges() {
		if (this.toString() != this.originalText) {
			let fileText = await this.app.vault.read(this.file);
			let oldFileText = fileText
			
			fileText = fileText.replace(this.originalText, this.toString());
			if (fileText == oldFileText) {
				console.log("file text didnt change")
				console.log(self)
				Notice("error: saving flashcard failed (see console)")
			} else {
				this.originalText = this.toString()
				this.app.vault.modify(this.file, fileText);
			}
		}
	}
}

export class Flashcard {
	front: string
	back: string
	
	dueDate: Date = new Date()
	level: number = 0
	
	constructor(front: string, back: string) {
		this.front = front;
		this.back = back;
	}
	
	isDue(currentDate: Date = new Date()): boolean {
		return currentDate >= this.dueDate
	}
	
	markAs(answer: "easy" | "medium" | "hard" | "wrong", currentDate: Date = new Date()) {
		if (answer == "wrong") {
			this.level = Math.round(this.level / 2)
			return
		}
		
		const levelChange = {"easy": 7, "medium": 3, "hard": 1}
		this.level = Math.round((this.level + 1) * levelChange[answer])
		
		const fuzz = this.level * (Math.random() * fuzziness * 2 - fuzziness)
		const daysToAdd = Math.round(this.level + fuzz)
		
		let dueDate = new Date()
		dueDate.setDate(currentDate.getDate() + daysToAdd)
		this.dueDate = dueDate
	}
	
	toString(): string {
		const year = this.dueDate.getFullYear().toString().padStart(4, "0");
		const month = (this.dueDate.getMonth() + 1).toString().padStart(2, "0"); // zero padded
		const day = this.dueDate.getDate().toString().padStart(2, "0");
		
		return base10to65536(parseInt(`${year}${month}${day}${this.level}`))
	}
}
