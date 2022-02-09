import { App, Editor, MarkdownView, MarkdownRenderer, Modal, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { Card } from "card";

// TODO: select subfolders or specific notes
// TODO: make included folders/notes more programatic

const commentRegex = /(%%sr[\w\W]*?[^\\]%%)|(?:%%[\w\W]*?(?:[^\\]%%|$))|(?:---[\w\W]*)|(?:<!--[\w\W]*?-->)/g
const srCommentRegex = /%%sr[\w\W]*?[^\\]%%/g

export default class MyPlugin extends Plugin {
	async onload() {
		this.addRibbonIcon("sheets-in-box", "separated recurrence", async (evt: MouseEvent) => {
			new SampleModal(this.app, await this.loadCards()).open();
		});
		
		this.addRibbonIcon("calendar-glyph", "divination", async (evt: MouseEvent) => {
			let allCards = await this.loadCards()
			
			let hits0at = -1
			console.clear()
			for (var daysInTheFuture = 0; daysInTheFuture < 75; daysInTheFuture++) {
				let simulatedDate = new Date()
				simulatedDate.setDate(simulatedDate.getDate() + daysInTheFuture)
				
				let cardsDueToday = allCards.filter(x => x.isDue(simulatedDate)).flatMap(x => x.flashcards).filter(x => x.isDue(simulatedDate));
				
				const year = simulatedDate.getFullYear().toString().padStart(4, "0");
				const month = (simulatedDate.getMonth() + 1).toString().padStart(2, "0");
				const day = simulatedDate.getDate().toString().padStart(2, "0");
				
				const formattedDate = `${year}-${month}-${day} `
				const bar = "=".repeat(cardsDueToday.length / 2)
				
				console.log(`${formattedDate} ${bar} ${cardsDueToday.length}`)
				
				if (hits0at == -1 && cardsDueToday.length == 0) {
					hits0at = daysInTheFuture
				}
				
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
					
					flashcard.markAs(difficulty, 0, simulatedDate)
				}
			}
		});
		
// 		this.addSettingTab(new SampleSettingTab(this.app, this));
// 		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {}
	
	async loadCards(): Card[] {
		let allCards: Card[] = []
		for (let file of this.app.vault.getMarkdownFiles()) {
			if (file.path.startsWith("flashcards")) {
				let fileText = await this.app.vault.read(file);
				const fileLinesWithoutComments = fileText.replace(commentRegex, "$1").split("\n").filter(line => line != "");
				for (let line of fileLinesWithoutComments) {
					const originalLine = line;
					let srCommentMatches = line.match(srCommentRegex);
					if (srCommentMatches) {
						line = line.replace(srCommentRegex, "");
					} else {
						srCommentMatches = [];
					}
					
					if (line.match("::")) {
						const [term, definition] = line.split("::");
						const isDoubleSided = true;
						allCards.push(new Card(this.app, term, definition, isDoubleSided, srCommentMatches, file, originalLine));
					} else if (line.match(":")) {
						const [term, definition] = line.split(":");
						const isDoubleSided = false;
						allCards.push(new Card(this.app, term, definition, isDoubleSided, srCommentMatches, file, originalLine));
					}
				}
			}
		}
		return allCards
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
        easyButton.addEventListener("click", () => {
			this.markEasy()
        });
        
		let mediumButton = this.buttonDiv.createDiv();
        mediumButton.setAttribute("class", "sr-button");
        mediumButton.setAttribute("id", "sr-medium-button");
        mediumButton.setText("medium");
        mediumButton.addEventListener("click", () => {
			this.markMedium()
        });
        
		let hardButton = this.buttonDiv.createDiv();
        hardButton.setAttribute("class", "sr-button");
        hardButton.setAttribute("id", "sr-hard-button");
        hardButton.setText("hard");
        hardButton.addEventListener("click", () => {
			this.markHard()
        });
        
		let wrongButton = this.buttonDiv.createDiv();
        wrongButton.setAttribute("class", "sr-button");
        wrongButton.setAttribute("id", "sr-wrong-button");
        wrongButton.setText("wrong")
        wrongButton.addEventListener("click", () => {
			this.markWrong()
        });
		
		this.showAnswerButton = contentEl.createDiv();
        this.showAnswerButton.setAttribute("id", "sr-show-answer-button");
        this.showAnswerButton.setText("show answer");
        this.showAnswerButton.addEventListener("click", () => {
			this.showBack();
        });
        
        this.nextCard();
	}
	
	nextCard() {
		this.hideBack();
		
		if (this.currentCardIndex != -1) {
			this.cards[this.currentCardIndex].writeChanges();
		}
		
		if (this.currentCardIndex != -1 && !this.cards[this.currentCardIndex].isDue()) {
			this.cards.splice(this.currentCardIndex, 1);
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
