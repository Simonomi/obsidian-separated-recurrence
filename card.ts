const fuzziness = .25 // as a percentage

const furiganaRegex = /{(?<kanji>(?:[\u4E00-\u9FFFㄅ-ㄩぁ-んァ-ンー〇])+)(?<hiragana>(?:\|[^ -\/{-~:-@\[-`]+)*)}/g
const srCommentRegex = /%%sr(?<type>d|r|kd|kr|)(?<index>\d*?)(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})(?<level>\d+)%%/g

class Furigana {
  kanji: string;
  readings: string[];
  
  constructor(input: string) {
  	const matches = input.matchAll(furiganaRegex);
  	for (const match of matches) {
  		this.kanji = match.groups.kanji;
  		this.readings = match.groups.hiragana.split("|").slice(1);
  	}
  }
  
  reading(): string {
  	return this.readings.join("");
  }
  
  toString(): string {
  	return "{" + [this.kanji, this.readings.join("|")].join("|") + "}";
  }
}

class Difficulty {
	type: "term" | "definition" | "reading" | "kanji (definition)" | "kanji (reading)"
	index: number
	dueDate: Date
	level: number = 1
	
	constructor(inputComment?: string) {
		if (inputComment == undefined) {
			return
		}
		
		let parsedInput = Array.from(inputComment.matchAll(srCommentRegex))[0]
		if (parsedInput != undefined) {
			parsedInput = parsedInput.groups
			const typesKey = {
				"": "term",
				"d": "definition",
				"r": "reading",
				"kd": "kanji (definition)",
				"kr": "kanji (reading)"
			}
			this.type = typesKey[parsedInput.type]
			this.index = parseInt(parsedInput.index)
			if (isNaN(this.index)) {
				this.index = 0
			}
			this.dueDate = new Date(
				parseInt(parsedInput.year),
				parseInt(parsedInput.month) - 1, // zero-indexed
				parseInt(parsedInput.day)
			)
			this.level = parseInt(parsedInput.level)
			return
		}
	}
	
	toString(): string {
		const typesKey = {
			"term": "",
			"definition": "d",
			"reading": "r",
			"kanji (definition)": "kd",
			"kanji (reading)": "kr"
		}
		const typeCode = typesKey[this.type]
		
		let index = ""
		if (this.index != 0) {
			index = this.index.toString()
		}
		
		if (this.dueDate == undefined) {
			this.dueDate = new Date()
		}
		
		const year = this.dueDate.getFullYear().toString().padStart(4, "0");
		const month = (this.dueDate.getMonth() + 1).toString().padStart(2, "0");
		const day = this.dueDate.getDate().toString().padStart(2, "0");
		
		return `%%sr${typeCode}${index}${year}-${month}-${day}${this.level}%%`
	}
}

export class Flashcard {
	front: string
	back: string
	difficulty: Difficulty
	type: "term" | "definition" | "reading" | "kanji (definition)" | "kanji (reading)"
	
	constructor(front: string, back: string, type: string) {
		this.front = front;
		this.back = back;
		this.type = type;
	}
	
	isDue(): boolean {
		return this.difficulty == undefined || this.difficulty.dueDate == undefined || new Date() >= this.difficulty.dueDate
	}
	
	markAs(answer: "easy" | "medium" | "hard" | "wrong", index: number = 0) {
		if (this.difficulty == undefined) {
			this.difficulty = new Difficulty()
			this.difficulty.type = this.type
			this.difficulty.index = index
		}
		
		if (answer == "wrong") {
			this.difficulty.level = 0
			return
		}
		
		const levelChange = {"easy": 3, "medium": 2, "hard": 1}
		this.difficulty.level += levelChange[answer]
		
		const fuzz = this.difficulty.level * (Math.random() * fuzziness * 2 - fuzziness)
		const daysToAdd = Math.round(this.difficulty.level + fuzz)
		
		let dueDate = new Date()
		dueDate.setDate(dueDate.getDate() + daysToAdd)
		this.difficulty.dueDate = dueDate
	}
}

export class Card {
	app: App
	flashcards: Flashcard[]
	isDoubleSided: boolean
	file: TFile
	
	originalCardTerm: string
	originalDefinition: string
	originalText: string
	
	constructor(app: App, term: string, definition: string, doubleSided: boolean, srComments: string[], file: TFile, originalText: string) {
		this.app = app
		this.isDoubleSided = doubleSided;
		this.file = file;
		this.originalText = originalText
		
		this.originalTerm = term.trim();
		this.originalDefinition = definition.trim();
		
		let terms = term.replace("\\/", "|||||")
		let definitions = definition.replace("\\/", "|||||")
		
		terms = terms.split("/").map(x => x.replace("|||||", "/").trim());
		definitions = definitions.split("/").map(x => x.replace("|||||", "/").trim());
		for (let index in terms) {
			let furigana = new Furigana(terms[index]);
			if (furigana.kanji != undefined && furigana.readings != undefined) {
				terms[index] = furigana;
			}
		}
		
		this.flashcards = []
		let uniqueTerms = new Set(terms.filter(x => typeof x == "string"));
		for (let term of uniqueTerms) {
			this.flashcards.push(new Flashcard(term, definitions.join("/"), "term"));
		}
		
		let uniqueKanji = new Set(terms.filter(x => x instanceof Furigana).map(x => x.kanji));
		for (let kanji of uniqueKanji) {
			let pluralLabel = definitions.length == 1 ? "" : "s"
			this.flashcards.push(new Flashcard(`${kanji} (definition${pluralLabel})`, definitions.join("/"), "kanji (definition)"));
			
			const readings = new Array(...new Set(terms.filter(x => x instanceof Furigana).map(x => x.reading())))
			pluralLabel = readings.length == 1 ? "" : "s"
			this.flashcards.push(new Flashcard(`${kanji} (reading${pluralLabel})`, readings.join("/"), "kanji (reading)"));
		}
		
		if (this.isDoubleSided) {
			for (let definition of definitions) {
				this.flashcards.push(new Flashcard(definition, terms.join("/"), "definition"));
			}
			
			let uniqueReadings = new Set(terms.filter(x => x instanceof Furigana).map(x => x.reading()));
			for (let reading of uniqueReadings) {
				this.flashcards.push(new Flashcard(reading, `${terms.join("/")} (${definitions.join("/")})`, "reading"));
			}
		}
		
		for (let comment of srComments) {
			const difficulty = new Difficulty(comment)
			let flashcard = this.flashcards.filter(x => x.type == difficulty.type)[difficulty.index]
			if (flashcard != undefined) {
				flashcard.difficulty = difficulty
			}
		}
	}
	
	isDue(): boolean {
		let dueCount = this.flashcards.filter(x => x.isDue()).length
		return dueCount * 2 >= this.flashcards.length // due if >= half of its flashcards are due
	}
	
	getFlashcard(): Flashcard { // TODO: change this?
		const dueFlashcards = this.flashcards.filter(x => x.isDue())
		return dueFlashcards[Math.floor(Math.random() * dueFlashcards.length)]
	}
	
	toString(): string {
		let difficulties: string[] = []
		for (let flashcard of this.flashcards) {
			if (flashcard.difficulty != undefined) {
				difficulties.push(flashcard.difficulty.toString())
			}
		}
		
		let comment = ""
		if (difficulties.length > 0) {
			comment = " " + difficulties.join(" ")
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
				Notice("no change")
			}
			
			this.originalText = this.toString()
			this.app.vault.modify(this.file, fileText);
		}
	}
}
