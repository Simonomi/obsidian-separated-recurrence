import { App, Editor, MarkdownView, MarkdownRenderer, Modal, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { Card } from "card";

const parseLineRegex = /^(?<term>|.*?[^\\])(?<divider>::?)(?<definition>.*?)$/m
const commentRegex = /(?:(?<a>^|[^\\])%%sr(?:(?:|.*?[^\\])%%|.*?$))|(?:(?<b>^|[^\\])%%(?:(?:|.*?[^\\])%%|.*?$))|(?:(?<c>^|[^\\])<!--(?:(?:|.*?[^\\])-->|.*?$))|(?:(?<d>^|[^\\])---.*)/gm
const srCommentRegex = /(?:(?:^|[^\\])(?:%%sr(?<srComment>(?:(?:|.*?[^\\])%%|.*?$))))|(?:(?:^|[^\\])%%(?:(?:|.*?[^\\])%%|.*?$))|(?:(?:^|[^\\])<!--(?:(?:|.*?[^\\])-->|.*?$))|(?:(?:^|[^\\])---.*)/m
const openCommentRegex =	/(?:^|[^\\])(?:(?:%%(?:|.*?[^\\])%%)|(?:<!--(?:|.*?[^\\])-->)|(?<comment>%%|<!--))/m

export default class MyPlugin extends Plugin {
	async onload() {
		this.addRibbonIcon("sheets-in-box", "separated recurrence", async (evt: MouseEvent) => {
			new SampleModal(this.app, await this.loadCards()).open();
		});
		
		this.addRibbonIcon("calendar-glyph", "divination", async (evt: MouseEvent) => {
			this.divine(await this.loadCards(), 750)
		});
		
// 		this.addSettingTab(new SampleSettingTab(this.app, this));
	}
	
	async loadCards(): Card[] {
		let allCards: Card[] = []
		for (let file of this.app.vault.getMarkdownFiles()) {
			if (file.path.startsWith("flashcards")) {
				allCards.push(...await this.loadCardsFromFile(file));
			}
		}
		return allCards
	}
	
	async loadCardsFromFile(file: TFlie): Card[] {
		let fileText = await this.app.vault.read(file)
		let splitFileText = fileText.split("\n")
		let openComment = ""
		let outputCards = []
		
		for (let line of splitFileText) {
			const originalLine = line
			line = openComment + line
			
			let srCommentMatch = line.match(srCommentRegex)
			let srComment
			if (srCommentMatch != undefined && srCommentMatch.groups.srComment != undefined) {
				srComment = srCommentMatch.groups.srComment.replace(/%%$/m, "")
			}
			
			let lineWithoutComments = line.replace(commentRegex, "$<a>$<b>$<c>$<d>")
			let parsedLine = lineWithoutComments.match(parseLineRegex)
			if (parsedLine != undefined) {
				parsedLine = parsedLine.groups
				outputCards.push(new Card(this.app, parsedLine.term, parsedLine.definition, parsedLine.divider == "::", srComment, file, originalLine))
			}
			
			const openCommentMatch = line.match(openCommentRegex)
			if (openCommentMatch != undefined && openCommentMatch.groups.comment != undefined) {
				openComment = openCommentMatch.groups.comment
			} else {
				openComment = ""
			}
			
			if (line.match(/(?:^|[^\\])---/gm)) {break}
		}
		
		return outputCards
	}
	
	divine(inputCards, daysToSimulate) {
		console.clear()
		let cards = inputCards
		for (let daysInTheFuture = 0; daysInTheFuture < daysToSimulate; daysInTheFuture++) {
			let simulatedDate = new Date()
			simulatedDate.setDate(simulatedDate.getDate() + daysInTheFuture)
			
			let cardsDueToday = cards.filter(x => x.isDue(simulatedDate)).flatMap(x => x.flashcards).filter(x => x.isDue(simulatedDate));
			
			const year = simulatedDate.getFullYear().toString().padStart(4, "0");
			const month = (simulatedDate.getMonth() + 1).toString().padStart(2, "0");
			const day = simulatedDate.getDate().toString().padStart(2, "0");
			
			const formattedDate = `${year}-${month}-${day} `
			const bar = "=".repeat(cardsDueToday.length / 2)
			
			console.log(`${formattedDate} ${bar} ${cardsDueToday.length}`)
			
			for (let flashcard of cardsDueToday) {
				let difficulties = []
				if (flashcard.difficulty == undefined) {
					difficulties = ["easy", "medium", "hard", "wrong"]
				} else if (flashcard.difficulty.level < 10) {
					difficulties = ["easy", "medium", "hard", "wrong"]
				} else if (flashcard.difficulty.level < 100) {
					difficulties = ["easy", "easy", "medium", "medium", "hard", "wrong"]
				} else if (flashcard.difficulty.level < 1000) {
					difficulties = ["easy", "medium", "hard"]
				} else if (flashcard.difficulty.level < 10000) {
					difficulties = ["easy", "easy", "easy", "medium", "medium", "hard"]
				} else {
					difficulties = ["easy", "medium"]
				}
				
				const difficulty = difficulties[Math.floor(Math.random() * difficulties.length)]
				
				flashcard.markAs(difficulty, simulatedDate)
			}
		}
	}
}

class SampleModal extends Modal {
	showingBack: boolean = false
	buttonDiv: HTMLElement
	frontDiv: HTMLElement
	backDiv: HTMLElement
	showAnswerButton: HTMLElement
	cards: Card[]
	currentCardIndex: number = -1
	currentFlashcard: Flashcard
	
	constructor(app: App, cards: Card[]) {
		super(app);
		this.cards = cards.filter(x => x.isDue())
	}
	
	onOpen() {
		const {contentEl} = this;
		this.modalEl.setAttribute("id", "sr-modal");
		
		document.body.onkeydown = (key) => {
			switch (key.code) {
				case 'KeyW':
				case 'KeyI':
					if (this.showingBack) {
						this.markWrong()
					}
					break;
				case 'KeyA':
				case 'KeyJ':
					if (this.showingBack) {
						this.markEasy()
					}
					break;
				case 'KeyS':
				case 'KeyK':
					if (this.showingBack) {
						this.markMedium()
					}
					break;
				case 'KeyD':
				case 'KeyL':
					if (this.showingBack) {
						this.markHard()
					}
					break;
				case "Space":
					if (!this.showingBack) {
						this.showBack();
					}
			}
		}
		
		this.headingDiv = contentEl.createDiv();
        this.headingDiv.setAttribute("id", "sr-modal-heading");
		
		this.headingRightDiv = contentEl.createDiv();
        this.headingRightDiv.setAttribute("id", "sr-modal-heading-right");
		
		this.frontDiv = contentEl.createDiv();
        this.frontDiv.setAttribute("class", "sr-modal-text");
		
		this.backDiv = contentEl.createDiv();
		this.backDiv.style.display = "none"
        this.backDiv.setAttribute("class", "sr-modal-text");
		
		this.buttonDiv = contentEl.createDiv();
		this.buttonDiv.setAttribute("id", "sr-buttons");
        
		let easyButton = this.buttonDiv.createDiv();
        easyButton.setAttribute("class", "sr-button");
        easyButton.setAttribute("id", "sr-easy-button");
        easyButton.setText("easy")
        easyButton.addEventListener("click", () => {this.markEasy()});
        
		let mediumButton = this.buttonDiv.createDiv();
        mediumButton.setAttribute("class", "sr-button");
        mediumButton.setAttribute("id", "sr-medium-button");
        mediumButton.setText("medium");
        mediumButton.addEventListener("click", () => {this.markMedium()});
        
		let hardButton = this.buttonDiv.createDiv();
        hardButton.setAttribute("class", "sr-button");
        hardButton.setAttribute("id", "sr-hard-button");
        hardButton.setText("hard");
        hardButton.addEventListener("click", () => {this.markHard()});
        
		let wrongButton = this.buttonDiv.createDiv();
        wrongButton.setAttribute("class", "sr-button");
        wrongButton.setAttribute("id", "sr-wrong-button");
        wrongButton.setText("wrong")
        wrongButton.addEventListener("click", () => {this.markWrong()});
		
		this.showAnswerButton = contentEl.createDiv();
        this.showAnswerButton.setAttribute("id", "sr-show-answer-button");
        this.showAnswerButton.setText("show answer");
        this.showAnswerButton.addEventListener("click", () => {this.showBack()});
        
        this.nextCard();
	}
	
	nextCard() {
		this.hideBack();
		
		if (this.currentCardIndex != -1) {
			this.cards[this.currentCardIndex].writeChanges();
		}
		
		if (this.currentCardIndex != -1 && !this.cards[this.currentCardIndex].isDue()) {
			this.cards.splice(this.currentCardIndex, 1);
			console.log("splice")
			this.currentCardIndex = -1;
		}
		
		if (this.cards.length == 0) {
			new Notice("no cards are due");
			this.close();
			return
		} else if (this.cards.length == 1) {
			this.currentCardIndex = -1;
		}
		
		let randomIndex = this.currentCardIndex;
		do {
			randomIndex = Math.floor(Math.random() * this.cards.length)
		} while (randomIndex == this.currentCardIndex);
		
		this.currentCardIndex = randomIndex;
		this.currentFlashcard = this.cards[this.currentCardIndex].getFlashcard();
		
		this.renderHeaderText(this.cards[this.currentCardIndex].file.name.replace(".md", ""))
		this.renderFrontText(this.currentFlashcard.front);
		this.loadBackText(this.currentFlashcard.back)
	}
	
	renderHeaderText(text: string) {
		this.headingDiv.empty();
		this.headingRightDiv.empty();
		MarkdownRenderer.renderMarkdown(text, this.headingDiv);
		
		const dueFlashcardCount = this.cards.flatMap(x => x.flashcards).filter(x => x.isDue()).length;
		const rightHeaderString = String(dueFlashcardCount);
		MarkdownRenderer.renderMarkdown(rightHeaderString, this.headingRightDiv);
	}
	
	renderFrontText(text: string) {
		this.frontDiv.empty();
		MarkdownRenderer.renderMarkdown(text, this.frontDiv);
	}
	
	loadBackText(text: string) {
		this.backDiv.empty();
		let divider = this.backDiv.createEl("hr");
		divider.setAttribute("id", "sr-divider");
		MarkdownRenderer.renderMarkdown(text, this.backDiv);
	}
	
	showBack() {
		this.showingBack = true;
		this.backDiv.style.display = "block";
		this.buttonDiv.style.display = "block";
		this.showAnswerButton.style.display = "none";
	}
	
	markEasy() {
		this.currentFlashcard.markAs("easy");
		this.nextCard();
	}
	
	markMedium() {
		this.currentFlashcard.markAs("medium");
		this.nextCard();
	}
	
	markHard() {
		this.currentFlashcard.markAs("hard");
		this.nextCard();
	}
	
	markWrong() {
		this.currentFlashcard.markAs("wrong");
		this.nextCard();
	}
	
	hideBack() {
		this.showingBack = false;
		this.backDiv.style.display = "none";
		this.buttonDiv.style.display = "none";
		this.showAnswerButton.style.display = "block";
	}

	onClose() {
		const {contentEl} = this;
		document.body.onkeydown = (key) => {};
		contentEl.empty();
	}
}

// class SampleSettingTab extends PluginSettingTab {
// 	plugin: MyPlugin;
// 
// 	constructor(app: App, plugin: MyPlugin) {
// 		super(app, plugin);
// 		this.plugin = plugin;
// 	}
// 
// 	display(): void {
// 		const {containerEl} = this;
// 
// 		containerEl.empty();
// 
// 		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});
// 
// 		new Setting(containerEl)
// 			.setName('Setting #1')
// 			.setDesc('It\'s a secret')
// 			.addText(text => text
// 				.setPlaceholder('Enter your secret')
// 				.setValue(this.plugin.settings.mySetting)
// 				.onChange(async (value) => {
// 					console.log('Secret: ' + value);
// 					this.plugin.settings.mySetting = value;
// 					await this.plugin.saveSettings();
// 				}));
// 	}
// }
